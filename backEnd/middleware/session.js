const { v4: uuidv4, validate: isUuid } = require("uuid");
const { getOrCreateSession } = require("../database/monetization");
const { lookupCountryCached } = require("../helpers/geolocation");
const {
  isMonetizationEnabledForCountry,
  isMonetizationEnabledAnywhere,
} = require("../helpers/monetizationConfig");
const logger = require("../helpers/logger");

const COOKIE_NAME = process.env.SESSION_COOKIE_NAME || "roast_session";
const MAX_AGE_MS =
  (Number(process.env.SESSION_COOKIE_MAX_AGE_DAYS) || 7) * 24 * 60 * 60 * 1000;

// "lax" is correct when the site and API share a registrable domain
// (instaroasts.com + api.instaroasts.com, or localhost:5173 + localhost:8080 —
// ports don't affect same-site). Serving the API from an unrelated domain (a
// dev tunnel, a different apex) makes every call cross-site, where Lax cookies
// are never sent and each request would look like a brand-new visitor; that
// setup needs "none", which browsers only honour on HTTPS with Secure.
const SAME_SITE = (process.env.SESSION_COOKIE_SAMESITE || "lax").toLowerCase();
const SECURE =
  process.env.SESSION_COOKIE_SECURE !== undefined
    ? !["false", "0", "off", "no"].includes(String(process.env.SESSION_COOKIE_SECURE).toLowerCase())
    : process.env.NODE_ENV === "production";

if (SAME_SITE === "none" && !SECURE) {
  logger.warning(
    "SESSION_COOKIE_SAMESITE=none requires Secure — browsers will reject the session cookie",
    { hint: "set SESSION_COOKIE_SECURE=true and serve the API over HTTPS" }
  );
}

// Cloudflare sets cf-connecting-ip to the true client IP; otherwise fall back to
// req.ip, which requires app.set("trust proxy", ...) to mean anything behind a
// load balancer.
function getClientIp(req) {
  return req.headers["cf-connecting-ip"] || req.ip || "";
}

// Attaches the anonymous entitlement session (req.roastSession) for every
// request, minting the `roast_session` cookie on first visit.
//
// Honours the per-region kill switches: a visitor whose region is switched off
// gets no cookie, no DB row and no entitlement checks at all — the feature is
// genuinely absent for them, not merely bypassed. Downstream code keys off
// `req.monetizationEnabled`.
async function sessionMiddleware(req, res, next) {
  try {
    req.clientIp = getClientIp(req);

    // Both regions off: nothing to classify, so skip the geo lookup too.
    if (!isMonetizationEnabledAnywhere()) {
      req.monetizationEnabled = false;
      return next();
    }

    const ip = req.clientIp;
    // Resolved before any session work, because the country is what decides
    // whether this visitor should have a session at all. Cached per IP so the
    // gating check doesn't hammer ip-api for unmonetized visitors.
    const countryCode = await lookupCountryCached(ip);
    req.visitorCountry = countryCode;

    if (!isMonetizationEnabledForCountry(countryCode)) {
      req.monetizationEnabled = false;
      return next();
    }

    req.monetizationEnabled = true;

    const existing = req.cookies?.[COOKIE_NAME];
    const isNew = !existing || !isUuid(existing);
    const sessionId = isNew ? uuidv4() : existing;

    if (isNew) {
      // Deliberately only set on creation: re-sending Set-Cookie on every request
      // would push the expiry forward each visit, turning the required fixed
      // 7-day window into a rolling one.
      res.cookie(COOKIE_NAME, sessionId, {
        httpOnly: false,
        sameSite: SAME_SITE,
        maxAge: MAX_AGE_MS,
        secure: SECURE,
        path: "/",
      });
    }

    req.roastSession = await getOrCreateSession(sessionId, ip, countryCode);
    next();
  } catch (error) {
    logger.error("Failed to establish roast session", { error: error.message });
    res.status(500).json({ message: "Internal Server Error" });
  }
}

module.exports = sessionMiddleware;
module.exports.getClientIp = getClientIp;
module.exports.COOKIE_NAME = COOKIE_NAME;
