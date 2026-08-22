const logger = require("./logger");

// Local-development bypass for the paid deep reading.
//
// This hands out a paid feature for free, so it is deliberately hard to switch
// on by accident. Two independent conditions must both hold, and the second one
// cannot be satisfied by anything reaching the server from the internet:
//
//   1. DEEP_READING_FREE is explicitly truthy in the environment.
//   2. The request's TCP peer is loopback.
//
// Condition 2 is the real guard. It reads req.socket.remoteAddress — the actual
// peer on the socket — and NOT req.clientIp, which getClientIp() derives from
// the `cf-connecting-ip` header. Any header is attacker-supplied unless a proxy
// is guaranteed to overwrite it, so a header must never gate a payment bypass.
// Behind Cloud Run or any load balancer the peer is the proxy's internal
// address; a request from a real visitor can never present as 127.0.0.1.
//
// The belt-and-braces matters because NODE_ENV is not a usable guard in this
// deployment: the Dockerfile never sets it, so `NODE_ENV !== "production"` is
// true in production too. A check written that way would have shipped the
// bypass live.

const LOOPBACK = new Set(["127.0.0.1", "::1", "::ffff:127.0.0.1"]);

function isTruthy(value) {
  if (value === undefined || value === null || value === "") return false;
  return !["false", "0", "off", "no"].includes(String(value).trim().toLowerCase());
}

// Warn once at boot rather than per request, so the log is impossible to miss
// on startup but does not drown the request log during a dev session.
let warned = false;
function warnOnce() {
  if (warned) return;
  warned = true;
  logger.warning(
    "[devAccess] DEEP_READING_FREE is on. Paid deep readings are free for loopback requests. " +
      "This must never be set in a deployed environment."
  );
}

function isDeepReadingFree(req) {
  if (!isTruthy(process.env.DEEP_READING_FREE)) return false;
  warnOnce();

  // Express strips nothing here: remoteAddress is whatever the kernel reports
  // for the connection, so a proxied request yields the proxy's address.
  const peer = req.socket?.remoteAddress ?? "";
  return LOOPBACK.has(peer);
}

module.exports = { isDeepReadingFree };
