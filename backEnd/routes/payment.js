require("dotenv").config();
const express = require("express");
const paymentRouter = express.Router();
const logger = require("../helpers/logger");
const {
  getRazorpayInstance,
  verifyPaymentSignature,
} = require("../helpers/razorpay");
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
      razorpayOrderId: order.id,
      amount,
      currency,
      creditsGranted: PAID_CREDITS_PER_PURCHASE,
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
      razorpayOrderId: orderId,
      razorpayPaymentId: paymentId,
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
