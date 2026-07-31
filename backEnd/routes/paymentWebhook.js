const express = require("express");
const paymentWebhookRouter = express.Router();
const logger = require("../helpers/logger");
const { verifyWebhookSignature } = require("../helpers/razorpay");
const { verifyPaypalWebhook } = require("../helpers/paypal");
const { markOrderPaidAndGrantCredits } = require("../database/monetization");

// Mounted before the global JWT middleware: Razorpay's servers call this
// directly and can't mint the app's short-lived integrity token, so the request
// authenticates itself via the webhook HMAC instead (same rationale as the SSE
// route). req.body here is the raw Buffer — see the express.raw() mount in
// index.js — because re-serialising a parsed body would change the signed bytes.
paymentWebhookRouter.post("/payment/webhook", async (req, res) => {
  const signature = req.headers["x-razorpay-signature"];

  if (!verifyWebhookSignature(req.body, signature)) {
    logger.warning("Rejected payment webhook: bad signature");
    return res.status(400).json({ message: "Invalid signature" });
  }

  let event;
  try {
    event = JSON.parse(req.body.toString("utf8"));
  } catch (error) {
    logger.error("Payment webhook body was not valid JSON", { error: error.message });
    return res.status(400).json({ message: "Malformed payload" });
  }

  // Anything other than a captured payment is acknowledged and ignored —
  // returning non-2xx would make Razorpay retry an event we don't act on.
  if (event.event !== "payment.captured") {
    return res.status(200).json({ received: true });
  }

  try {
    const payment = event.payload?.payment?.entity;
    if (!payment?.order_id) {
      logger.warning("payment.captured webhook missing order_id");
      return res.status(200).json({ received: true });
    }

    const updated = await markOrderPaidAndGrantCredits({
      orderId: payment.order_id,
      paymentId: payment.id,
      gateway: "razorpay",
    });

    // updated === null means /payment/verify already credited this order. Still
    // a 200 — it's a successful no-op, and a retry would change nothing.
    logger.info("Payment webhook processed", {
      orderId: payment.order_id,
      alreadyCredited: !updated,
    });
    return res.status(200).json({ received: true });
  } catch (error) {
    // Genuine failure — non-2xx so Razorpay retries this delivery.
    logger.error("Error processing payment webhook", { error: error.message });
    return res.status(500).json({ message: "Webhook processing failed" });
  }
});

// PayPal's backstop for the capture route: covers a capture that succeeded on
// PayPal's side but whose credit grant failed mid-request. Also mounted before
// JWT with a raw body (see index.js) — PayPal signs the original bytes and the
// verification API is shown them verbatim.
paymentWebhookRouter.post("/payment/paypal/webhook", async (req, res) => {
  let verified;
  try {
    verified = await verifyPaypalWebhook({ headers: req.headers, rawBody: req.body });
  } catch (error) {
    // Verification is an API call, so it can fail for reasons other than a bad
    // signature — non-2xx makes PayPal redeliver rather than dropping the event.
    logger.error("PayPal webhook verification errored", { error: error.message });
    return res.status(500).json({ message: "Verification failed" });
  }

  if (!verified) {
    logger.warning("Rejected PayPal webhook: bad signature");
    return res.status(400).json({ message: "Invalid signature" });
  }

  let event;
  try {
    event = JSON.parse(req.body.toString("utf8"));
  } catch (error) {
    logger.error("PayPal webhook body was not valid JSON", { error: error.message });
    return res.status(400).json({ message: "Malformed payload" });
  }

  // Same policy as the Razorpay handler: acknowledge everything we don't act
  // on, or PayPal retries events that will never matter.
  if (event.event_type !== "PAYMENT.CAPTURE.COMPLETED") {
    return res.status(200).json({ received: true });
  }

  try {
    const orderId = event.resource?.supplementary_data?.related_ids?.order_id;
    if (!orderId) {
      logger.warning("PAYMENT.CAPTURE.COMPLETED webhook missing order id");
      return res.status(200).json({ received: true });
    }

    const updated = await markOrderPaidAndGrantCredits({
      orderId,
      paymentId: event.resource?.id || null,
      gateway: "paypal",
    });

    // null means the capture route already credited this order — successful no-op.
    logger.info("PayPal webhook processed", { orderId, alreadyCredited: !updated });
    return res.status(200).json({ received: true });
  } catch (error) {
    logger.error("Error processing PayPal webhook", { error: error.message });
    return res.status(500).json({ message: "Webhook processing failed" });
  }
});

module.exports = paymentWebhookRouter;
