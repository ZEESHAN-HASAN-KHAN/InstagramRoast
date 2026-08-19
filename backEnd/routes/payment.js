require("dotenv").config();
const express = require("express");
const paymentRouter = express.Router();
const logger = require("../helpers/logger");
const {
  getRazorpayInstance,
  verifyPaymentSignature,
} = require("../helpers/razorpay");
const {
  createPaypalOrder,
  capturePaypalOrder,
} = require("../helpers/paypal");
const { getPriceForCountry, PAID_CREDITS_PER_PURCHASE } = require("../helpers/pricing");
const { getMintPrice } = require("../helpers/mintPricing");
const { verifyHandle } = require("../helpers/handleCheck");
const { getAIResponse, getUserData } = require("../database/db");
const { assignMint, getMintSummary, reserveMint, getMintById } = require("../database/mints");
const {
  createPaymentOrder,
  getPaymentOrder,
  markOrderPaidAndFulfil,
  getSession,
  FREE_ROAST_LIMIT,
} = require("../database/monetization");

// Refuses anything payment-related when this visitor's region has monetization
// switched off — they have no session to credit, and taking money for roasts
// that are currently free would be worse than a 403.
function requireMonetization(req, res, next) {
  if (!req.monetizationEnabled || !req.roastSession) {
    return res.status(403).json({ message: "Payments are not enabled here" });
  }
  next();
}

// --- First Mint claims -------------------------------------------------------

const ALLOWED_LANGUAGES = (process.env.ALLOWED_LANGUAGE || "english")
  .split(",")
  .map((l) => l.trim())
  .filter(Boolean);

const parseLanguage = (value) =>
  ALLOWED_LANGUAGES.includes(value) ? value : "english";

/**
 * Everything both mint-checkout routes have to do before they can talk to a
 * gateway: prove the handle, find the card on screen, take the reservation, and
 * price the number.
 *
 * Order matters. The reservation is taken BEFORE the gateway order is created,
 * because the whole point is to refuse the second claimant while refusing is
 * still free — after money has moved, the only remedy is a refund.
 *
 * Resolves to { error: { status, message } } or { mint, price, handle }.
 */
async function prepareMintClaim(req) {
  const { username, language, handle, responseId } = req.body || {};
  if (!username || typeof username !== "string") {
    return { error: { status: 400, message: "Missing username" } };
  }

  // A claim can target a specific archived card rather than whatever is newest.
  // That is where the scarce numbers actually are: once a handle has been
  // roasted twice its mint #1 is archived, and without this the premium rung
  // would only ever be sellable on handles nobody had touched yet.
  if (responseId !== undefined && responseId !== null) {
    if (!Number.isInteger(responseId) || responseId <= 0) {
      return { error: { status: 400, message: "Bad roast id" } };
    }
  }

  const check = await verifyHandle(handle);
  if (!check.ok) {
    // 'unavailable' is our lookup breaking, not the buyer's handle being wrong.
    // A 400 there would tell someone their real account doesn't exist.
    if (check.reason === "unavailable") {
      return { error: { status: 503, message: "Could not check that handle right now. Try again." } };
    }
    return {
      error: {
        status: 400,
        message:
          check.reason === "not_found"
            ? "No Instagram account with that handle"
            : "That doesn't look like an Instagram handle",
      },
    };
  }

  // Resolve the card being claimed, and the profile it must belong to. The
  // targeted branch still goes through the username: the mint row names its own
  // profile, and cross-checking it against the handle in the request is what
  // stops a claim being pointed at some other profile's cheap number while the
  // page shows this one.
  const profile = await getUserData(username);
  if (!profile) {
    return { error: { status: 404, message: "Profile not found" } };
  }

  let aiResponseId;
  if (responseId) {
    aiResponseId = responseId;
  } else {
    const roast = await getAIResponse(username, parseLanguage(language));
    if (!roast) {
      return { error: { status: 404, message: "No roast for this profile" } };
    }
    aiResponseId = roast.id;
  }

  // Roasts minted before card_mints existed are backfilled at boot, but a row
  // whose mint write was lost heals here rather than being unsellable forever.
  const mint =
    (await getMintSummary(aiResponseId)) ||
    (await assignMint({ profileId: profile.id, aiResponseId }));
  if (!mint) {
    return { error: { status: 404, message: "No card for that roast" } };
  }
  if (mint.profile_id !== profile.id) {
    logger.warning("Rejected mint claim: roast does not belong to that profile", {
      username,
      responseId,
    });
    return { error: { status: 403, message: "That card belongs to a different profile" } };
  }
  if (mint.claimed_by) {
    return { error: { status: 409, message: `Mint #${mint.mint_no} is already claimed` } };
  }

  const reserved = await reserveMint({ mintId: mint.id, sessionId: req.roastSession.id });
  if (!reserved) {
    return {
      error: { status: 409, message: "Someone else is claiming this mint right now. Try again in a few minutes." },
    };
  }

  const price = getMintPrice(req.visitorCountry ?? req.roastSession.country_code, mint.mint_no);
  return { mint, price, handle: check.handle };
}

/**
 * Reads back what a paid order actually delivered, for the confirmation body.
 *
 * Deliberately re-reads the mint instead of trusting the fulfilment statement's
 * return value: that statement is idempotent and returns nothing when the
 * webhook already ran, and a confirmation that showed nothing in that case
 * would look like a failed purchase to someone who has been charged.
 */
async function describeMintFulfilment(order, orderId) {
  if (!order || order.purpose !== "mint" || !order.mint_id) return null;

  const mint = await getMintById(order.mint_id);
  if (!mint || !mint.claimed_by) {
    logger.critical("Paid mint claim was not fulfilled", { orderId, mintId: order.mint_id });
    return null;
  }
  // The money moved but the number went to someone else — the reservation makes
  // this rare, and it can only be settled by a refund, so it must be loud.
  if (mint.claimed_by !== order.claim_handle) {
    logger.critical("Paid mint claim lost the race to another claimant", {
      orderId,
      mintId: order.mint_id,
      paidFor: order.claim_handle,
      claimedBy: mint.claimed_by,
    });
    return null;
  }
  return { mintNo: mint.mint_no, claimedBy: mint.claimed_by, username: mint.username };
}

// Creates the Razorpay order the frontend opens Checkout against. Price is
// derived server-side from the visitor's country — the client never gets to
// name its own amount or currency.
paymentRouter.post("/payment/createOrder", requireMonetization, async (req, res) => {
  try {
    const session = req.roastSession;
    const { amount, currency } = getPriceForCountry(req.visitorCountry ?? session.country_code);

    const order = await getRazorpayInstance().orders.create({
      amount,
      currency,
      // Razorpay caps receipt at 40 chars; a bare uuid is 36.
      receipt: session.id,
      notes: { sessionId: session.id },
    });

    await createPaymentOrder({
      sessionId: session.id,
      orderId: order.id,
      amount,
      currency,
      creditsGranted: PAID_CREDITS_PER_PURCHASE,
      gateway: "razorpay",
    });

    logger.info("Payment order created", { orderId: order.id, amount, currency });

    return res.status(200).json({
      orderId: order.id,
      amount,
      currency,
      credits: PAID_CREDITS_PER_PURCHASE,
      // Sent from here rather than duplicated into a frontend env var, so the
      // key can never drift out of sync with the secret it pairs with.
      keyId: process.env.RAZORPAY_KEY_ID,
    });
  } catch (error) {
    logger.error("Error creating payment order", { error: error.message });
    return res.status(500).json({ message: "Could not start checkout" });
  }
});

// Client-driven confirmation, fired from Checkout's success handler. The webhook
// covers the case where the user closes the tab before this lands.
paymentRouter.post("/payment/verify", requireMonetization, async (req, res) => {
  try {
    const {
      razorpay_order_id: orderId,
      razorpay_payment_id: paymentId,
      razorpay_signature: signature,
    } = req.body;

    if (!verifyPaymentSignature({ orderId, paymentId, signature })) {
      logger.warning("Rejected payment verification: bad signature", { orderId });
      return res.status(400).json({ message: "Invalid payment signature" });
    }

    const order = await getPaymentOrder(orderId);
    if (!order) {
      return res.status(404).json({ message: "Unknown order" });
    }

    // Without this, a valid {order, payment, signature} triple observed from
    // someone else's purchase could be replayed to credit a different session.
    if (order.session_id !== req.roastSession.id) {
      logger.warning("Rejected payment verification: session mismatch", { orderId });
      return res.status(403).json({ message: "Order does not belong to this session" });
    }

    // null means the webhook already fulfilled this order — not an error. What
    // fulfilment does depends on the order's purpose, which was fixed when it
    // was priced; this route serves credit top-ups and mint claims alike.
    const fulfilled = await markOrderPaidAndFulfil({
      orderId,
      paymentId,
      gateway: "razorpay",
    });
    const session = fulfilled?.session || (await getSession(req.roastSession.id));
    const mint = await describeMintFulfilment(order, orderId);

    logger.info("Payment verified", {
      orderId,
      purpose: order.purpose,
      alreadyFulfilled: !fulfilled,
    });

    return res.status(200).json({
      success: true,
      paidCredits: session ? session.paid_credits : 0,
      mint,
    });
  } catch (error) {
    logger.error("Error verifying payment", { error: error.message });
    return res.status(500).json({ message: "Could not verify payment" });
  }
});


// PayPal handles everyone outside India: RBI bars PayPal from domestic INR
// payments, so an INR-priced visitor is refused here and uses Razorpay instead.
// The same door in requireMonetization applies to all three routes below.
function requireInternational(req, res, next) {
  const { currency } = getPriceForCountry(req.visitorCountry ?? req.roastSession.country_code);
  if (currency === "INR") {
    return res.status(400).json({ message: "PayPal is not available for Indian payments" });
  }
  next();
}

// The client id is public by design (it ships in the SDK script URL), but the
// frontend gets it from here rather than a frontend env var — same reasoning as
// keyId above: it can never drift out of sync with the secret it pairs with.
paymentRouter.get(
  "/payment/paypal/config",
  requireMonetization,
  requireInternational,
  (req, res) => {
    if (!process.env.PAYPAL_CLIENT_ID) {
      return res.status(503).json({ message: "PayPal is not configured" });
    }
    const { currency } = getPriceForCountry(req.visitorCountry ?? req.roastSession.country_code);
    return res.status(200).json({ clientId: process.env.PAYPAL_CLIENT_ID, currency });
  }
);

// Mirror of /payment/createOrder for the PayPal flow — price is still derived
// server-side, the client only ever gets an opaque order id to approve.
paymentRouter.post(
  "/payment/paypal/createOrder",
  requireMonetization,
  requireInternational,
  async (req, res) => {
    try {
      const session = req.roastSession;
      const { amount, currency } = getPriceForCountry(req.visitorCountry ?? session.country_code);

      const order = await createPaypalOrder({
        amount,
        currency,
        sessionId: session.id,
        description: `${PAID_CREDITS_PER_PURCHASE} InstaRoasts credits`,
      });

      await createPaymentOrder({
        sessionId: session.id,
        orderId: order.id,
        amount,
        currency,
        creditsGranted: PAID_CREDITS_PER_PURCHASE,
        gateway: "paypal",
      });

      logger.info("PayPal order created", { orderId: order.id, amount, currency });

      return res.status(200).json({
        orderId: order.id,
        amount,
        currency,
        credits: PAID_CREDITS_PER_PURCHASE,
      });
    } catch (error) {
      logger.error("Error creating PayPal order", { error: error.message });
      return res.status(500).json({ message: "Could not start checkout" });
    }
  }
);

// Fired from the PayPal Buttons onApprove callback. Capture happens here,
// server-side — approval alone never moves money, so a closed tab before this
// point costs the buyer nothing. Trust comes from PayPal's capture API
// answering for the order, not from anything the client asserts.
paymentRouter.post(
  "/payment/paypal/capture",
  requireMonetization,
  requireInternational,
  async (req, res) => {
    try {
      const { orderId } = req.body || {};
      if (!orderId || typeof orderId !== "string") {
        return res.status(400).json({ message: "Missing order id" });
      }

      const order = await getPaymentOrder(orderId, "paypal");
      if (!order) {
        return res.status(404).json({ message: "Unknown order" });
      }

      // Same replay guard as the Razorpay verify route: an order id observed
      // from someone else's purchase can't credit a different session.
      if (order.session_id !== req.roastSession.id) {
        logger.warning("Rejected PayPal capture: session mismatch", { orderId });
        return res.status(403).json({ message: "Order does not belong to this session" });
      }

      const { captured, captureId } = await capturePaypalOrder(orderId);
      if (!captured) {
        return res.status(400).json({ message: "Payment was not approved" });
      }

      // null means the webhook (or a concurrent capture retry) already fulfilled
      // this order — not an error.
      const fulfilled = await markOrderPaidAndFulfil({
        orderId,
        paymentId: captureId,
        gateway: "paypal",
      });
      const session = fulfilled?.session || (await getSession(req.roastSession.id));
      const mint = await describeMintFulfilment(order, orderId);

      logger.info("PayPal payment captured", {
        orderId,
        purpose: order.purpose,
        alreadyFulfilled: !fulfilled,
      });

      return res.status(200).json({
        success: true,
        paidCredits: session ? session.paid_credits : 0,
        mint,
      });
    } catch (error) {
      logger.error("Error capturing PayPal payment", { error: error.message });
      return res.status(500).json({ message: "Could not verify payment" });
    }
  }
);

// Opens a Razorpay checkout for a First Mint claim. Same server-derived-price
// rule as the credits route — the client names the card it is claiming, never
// the amount, and the amount follows from the mint number.
paymentRouter.post("/payment/mint/createOrder", requireMonetization, async (req, res) => {
  try {
    const prepared = await prepareMintClaim(req);
    if (prepared.error) {
      return res.status(prepared.error.status).json({ message: prepared.error.message });
    }
    const { mint, price, handle } = prepared;
    const session = req.roastSession;

    const order = await getRazorpayInstance().orders.create({
      amount: price.amount,
      currency: price.currency,
      receipt: session.id,
      notes: { sessionId: session.id, mintId: String(mint.id), claimHandle: handle },
    });

    await createPaymentOrder({
      sessionId: session.id,
      orderId: order.id,
      amount: price.amount,
      currency: price.currency,
      // A claim buys a name on a card, not an LLM run. Zero here keeps the
      // fulfilment statement's credits branch from ever handing out a roast.
      creditsGranted: 0,
      gateway: "razorpay",
      purpose: "mint",
      mintId: mint.id,
      claimHandle: handle,
    });

    logger.info("Mint claim order created", {
      orderId: order.id,
      mintId: mint.id,
      mintNo: mint.mint_no,
      ...price,
    });

    return res.status(200).json({
      orderId: order.id,
      amount: price.amount,
      currency: price.currency,
      mintNo: mint.mint_no,
      handle,
      keyId: process.env.RAZORPAY_KEY_ID,
    });
  } catch (error) {
    logger.error("Error creating mint claim order", { error: error.message });
    return res.status(500).json({ message: "Could not start checkout" });
  }
});

// PayPal twin of the route above, under the same India/international split as
// the credits flow.
paymentRouter.post(
  "/payment/mint/paypal/createOrder",
  requireMonetization,
  requireInternational,
  async (req, res) => {
    try {
      const prepared = await prepareMintClaim(req);
      if (prepared.error) {
        return res.status(prepared.error.status).json({ message: prepared.error.message });
      }
      const { mint, price, handle } = prepared;
      const session = req.roastSession;

      const order = await createPaypalOrder({
        amount: price.amount,
        currency: price.currency,
        sessionId: session.id,
        description: `InstaRoasts mint #${mint.mint_no} claim`,
      });

      await createPaymentOrder({
        sessionId: session.id,
        orderId: order.id,
        amount: price.amount,
        currency: price.currency,
        creditsGranted: 0,
        gateway: "paypal",
        purpose: "mint",
        mintId: mint.id,
        claimHandle: handle,
      });

      logger.info("PayPal mint claim order created", {
        orderId: order.id,
        mintId: mint.id,
        mintNo: mint.mint_no,
        ...price,
      });

      return res.status(200).json({
        orderId: order.id,
        amount: price.amount,
        currency: price.currency,
        mintNo: mint.mint_no,
        handle,
      });
    } catch (error) {
      logger.error("Error creating PayPal mint claim order", { error: error.message });
      return res.status(500).json({ message: "Could not start checkout" });
    }
  }
);

// Lets the frontend show remaining balance without burning a roast. Reports the
// switched-off state plainly rather than 403ing, so a client can tell "roasts
// are free here" apart from "something broke".
paymentRouter.get("/payment/credits", async (req, res) => {
  const session = req.roastSession;
  if (!req.monetizationEnabled || !session) {
    return res.status(200).json({ monetizationEnabled: false, unlimited: true });
  }

  const { amount, currency } = getPriceForCountry(req.visitorCountry ?? session.country_code);
  return res.status(200).json({
    monetizationEnabled: true,
    freeUsed: session.free_used,
    freeLimit: FREE_ROAST_LIMIT,
    paidCredits: session.paid_credits,
    price: { amount, currency, credits: PAID_CREDITS_PER_PURCHASE },
  });
});

module.exports = paymentRouter;
