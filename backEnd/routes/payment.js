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
const {
  createPaymentOrder,
  getPaymentOrder,
  markOrderPaidAndGrantCredits,
  getSession,
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

    // null means the webhook already credited this order — not an error.
    const updated = await markOrderPaidAndGrantCredits({
      orderId,
      paymentId,
      gateway: "razorpay",
    });
    const session = updated || (await getSession(req.roastSession.id));

    logger.info("Payment verified", { orderId, alreadyCredited: !updated });

    return res.status(200).json({
      success: true,
      paidCredits: session ? session.paid_credits : 0,
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

      // null means the webhook (or a concurrent capture retry) already credited
      // this order — not an error.
      const updated = await markOrderPaidAndGrantCredits({
        orderId,
        paymentId: captureId,
        gateway: "paypal",
      });
      const session = updated || (await getSession(req.roastSession.id));

      logger.info("PayPal payment captured", { orderId, alreadyCredited: !updated });

      return res.status(200).json({
        success: true,
        paidCredits: session ? session.paid_credits : 0,
      });
    } catch (error) {
      logger.error("Error capturing PayPal payment", { error: error.message });
      return res.status(500).json({ message: "Could not verify payment" });
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
    paidCredits: session.paid_credits,
    price: { amount, currency, credits: PAID_CREDITS_PER_PURCHASE },
  });
});

module.exports = paymentRouter;
