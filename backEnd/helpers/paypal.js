const logger = require("./logger");

// Sandbox unless explicitly told otherwise, so a deploy that forgets the env
// var can never accidentally capture real money.
function baseUrl() {
  return process.env.PAYPAL_ENV === "live"
    ? "https://api-m.paypal.com"
    : "https://api-m.sandbox.paypal.com";
}

function requireConfig() {
  if (!process.env.PAYPAL_CLIENT_ID || !process.env.PAYPAL_CLIENT_SECRET) {
    throw new Error("PayPal is not configured (missing PAYPAL_CLIENT_ID/PAYPAL_CLIENT_SECRET)");
  }
}

// OAuth tokens live ~9 hours; cached with a safety margin so we don't hit the
// token endpoint on every checkout. Re-fetched lazily on expiry.
let cachedToken = null;
let cachedTokenExpiresAt = 0;

async function getAccessToken() {
  requireConfig();

  if (cachedToken && Date.now() < cachedTokenExpiresAt) {
    return cachedToken;
  }

  const credentials = Buffer.from(
    `${process.env.PAYPAL_CLIENT_ID}:${process.env.PAYPAL_CLIENT_SECRET}`
  ).toString("base64");

  const response = await fetch(`${baseUrl()}/v1/oauth2/token`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${credentials}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`PayPal token request failed (${response.status}): ${body}`);
  }

  const data = await response.json();
  cachedToken = data.access_token;
  // 60s margin so a token can't expire between here and the API call it guards.
  cachedTokenExpiresAt = Date.now() + (data.expires_in - 60) * 1000;
  return cachedToken;
}

async function paypalFetch(path, { method = "POST", body } = {}) {
  const token = await getAccessToken();
  const response = await fetch(`${baseUrl()}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });

  // Callers need the parsed body even on non-2xx — PayPal encodes actionable
  // states (ORDER_ALREADY_CAPTURED, ORDER_NOT_APPROVED) as 422 issues.
  let data = null;
  const text = await response.text();
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = { raw: text };
    }
  }
  return { ok: response.ok, status: response.status, data };
}

// Creates a CAPTURE-intent order. Money only moves when we later capture
// server-side, so an abandoned approval never charges the buyer. `amount` is in
// the currency's smallest unit (cents), same convention as the Razorpay path.
async function createPaypalOrder({ amount, currency, sessionId, description }) {
  const { ok, status, data } = await paypalFetch("/v2/checkout/orders", {
    body: {
      intent: "CAPTURE",
      purchase_units: [
        {
          amount: {
            currency_code: currency,
            value: (amount / 100).toFixed(2),
          },
          // Round-trips through capture webhooks, tying the event back to the
          // visitor session without a DB lookup on PayPal's side.
          custom_id: sessionId,
          description,
        },
      ],
    },
  });

  if (!ok) {
    throw new Error(`PayPal order creation failed (${status}): ${JSON.stringify(data)}`);
  }
  return data;
}

// Captures an approved order. Returns { captured, captureId, alreadyCaptured }.
// A repeat capture (client retry racing the first attempt) comes back as a 422
// ORDER_ALREADY_CAPTURED — success from the buyer's point of view, so it's
// reported as captured rather than thrown; the idempotent credit grant makes
// double-crediting impossible downstream.
async function capturePaypalOrder(orderId) {
  const { ok, status, data } = await paypalFetch(
    `/v2/checkout/orders/${encodeURIComponent(orderId)}/capture`
  );

  if (ok) {
    const capture = data?.purchase_units?.[0]?.payments?.captures?.[0];
    return {
      captured: data.status === "COMPLETED" && capture?.status === "COMPLETED",
      captureId: capture?.id || null,
      alreadyCaptured: false,
    };
  }

  const issue = data?.details?.[0]?.issue;
  if (status === 422 && issue === "ORDER_ALREADY_CAPTURED") {
    return { captured: true, captureId: null, alreadyCaptured: true };
  }
  if (status === 422 && issue === "ORDER_NOT_APPROVED") {
    return { captured: false, captureId: null, alreadyCaptured: false };
  }

  throw new Error(`PayPal capture failed (${status}): ${JSON.stringify(data)}`);
}

// PayPal has no HMAC shared secret — verification is an API call where PayPal
// itself checks the transmission signature. The raw body is spliced into the
// request as-is because re-serialising a parsed copy could reorder keys and
// break the signature over the original bytes.
async function verifyPaypalWebhook({ headers, rawBody }) {
  if (!process.env.PAYPAL_WEBHOOK_ID) {
    logger.warning("PayPal webhook received but PAYPAL_WEBHOOK_ID is not set");
    return false;
  }

  const fields = {
    transmission_id: headers["paypal-transmission-id"],
    transmission_time: headers["paypal-transmission-time"],
    cert_url: headers["paypal-cert-url"],
    auth_algo: headers["paypal-auth-algo"],
    transmission_sig: headers["paypal-transmission-sig"],
    webhook_id: process.env.PAYPAL_WEBHOOK_ID,
  };
  if (Object.values(fields).some((v) => !v)) return false;

  const token = await getAccessToken();
  const body = `${JSON.stringify(fields).slice(0, -1)},"webhook_event":${rawBody.toString("utf8")}}`;

  const response = await fetch(`${baseUrl()}/v1/notifications/verify-webhook-signature`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body,
  });

  if (!response.ok) return false;
  const data = await response.json();
  return data.verification_status === "SUCCESS";
}

module.exports = { createPaypalOrder, capturePaypalOrder, verifyPaypalWebhook };
