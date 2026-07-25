const Razorpay = require("razorpay");
const crypto = require("crypto");

// Built on first use, not at import: the SDK constructor throws when key_id is
// missing, which would otherwise take the entire server down at boot just
// because payment credentials aren't configured yet. This way an unconfigured
// deploy still serves roasts and only checkout fails.
let instance = null;
function getRazorpayInstance() {
  if (!instance) {
    if (!process.env.RAZORPAY_KEY_ID || !process.env.RAZORPAY_KEY_SECRET) {
      throw new Error("Razorpay is not configured (missing RAZORPAY_KEY_ID/RAZORPAY_KEY_SECRET)");
    }
    instance = new Razorpay({
      key_id: process.env.RAZORPAY_KEY_ID,
      key_secret: process.env.RAZORPAY_KEY_SECRET,
    });
  }
  return instance;
}

// Constant-time compare of two hex digests. timingSafeEqual throws on length
// mismatch, so the length check has to come first — a wrong-length signature is
// simply invalid, and its length isn't secret.
function safeCompare(a, b) {
  const bufA = Buffer.from(a, "utf8");
  const bufB = Buffer.from(b, "utf8");
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

// Checkout's client-side callback signature: HMAC of "<order_id>|<payment_id>"
// keyed with the API secret.
function verifyPaymentSignature({ orderId, paymentId, signature }) {
  if (!orderId || !paymentId || !signature) return false;
  const expected = crypto
    .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
    .update(`${orderId}|${paymentId}`)
    .digest("hex");
  return safeCompare(expected, signature);
}

// Webhook signature: HMAC over the RAW request body, keyed with the webhook
// secret (a different secret from the API key secret). Re-serialising a parsed
// body would change the bytes and break this, hence the express.raw() mount.
function verifyWebhookSignature(rawBody, signature) {
  if (!rawBody || !signature || !process.env.RAZORPAY_WEBHOOK_SECRET) return false;
  const expected = crypto
    .createHmac("sha256", process.env.RAZORPAY_WEBHOOK_SECRET)
    .update(rawBody)
    .digest("hex");
  return safeCompare(expected, signature);
}

module.exports = { getRazorpayInstance, verifyPaymentSignature, verifyWebhookSignature };
