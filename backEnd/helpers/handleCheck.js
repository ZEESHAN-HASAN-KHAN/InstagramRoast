const logger = require("./logger");
const { getInstagramProfile, ProfileNotFoundError } = require("./apiHelper");
const { checkUserExists } = require("../database/db");

// Instagram's own rules: 1–30 characters, letters/digits/underscore/period, and
// a period can be neither the first nor last character nor doubled. Checking
// the shape first means an obviously-invalid handle never reaches the API and
// never spends a RapidAPI call.
const HANDLE_SHAPE = /^(?!.*\.\.)(?!\.)(?!.*\.$)[A-Za-z0-9._]{1,30}$/;

function normalizeHandle(raw) {
  if (typeof raw !== "string") return null;
  const trimmed = raw.trim().replace(/^@+/, "").toLowerCase();
  return HANDLE_SHAPE.test(trimmed) ? trimmed : null;
}

// Verified handles are cached because the failure mode without it is expensive:
// a claim that fails at checkout gets retried, and every retry would otherwise
// burn another Instagram lookup out of a rate-limited key pool. Positive
// results only — a handle that didn't exist a minute ago might exist now, and
// caching that would lock someone out of their own new account.
const CACHE_TTL_MS = Number(process.env.HANDLE_CHECK_TTL_MS) || 30 * 60 * 1000;
const verified = new Map();

function cacheHit(handle) {
  const entry = verified.get(handle);
  if (!entry) return false;
  if (Date.now() > entry) {
    verified.delete(handle);
    return false;
  }
  return true;
}

/**
 * Confirms an Instagram handle is real before it gets printed on a card face.
 *
 * Three escalating checks, cheapest first: shape, then our own profiles table
 * (anyone already roasted is known-good and free to confirm), then the live
 * Instagram lookup.
 *
 * This proves the account EXISTS, not that the claimant owns it — someone can
 * still claim as a handle that isn't theirs. That's an accepted trade against
 * making people paste a code into their bio mid-checkout; the refund/takedown
 * route in the terms page is the backstop.
 *
 * Returns { ok: true, handle } or { ok: false, reason } where reason is one of
 * 'invalid' | 'not_found' | 'unavailable'. 'unavailable' means the lookup
 * itself broke, which callers should treat as a soft failure worth retrying —
 * never as proof the handle is fake.
 */
async function verifyHandle(raw) {
  const handle = normalizeHandle(raw);
  if (!handle) return { ok: false, reason: "invalid" };
  if (cacheHit(handle)) return { ok: true, handle };

  try {
    if (await checkUserExists(handle)) {
      verified.set(handle, Date.now() + CACHE_TTL_MS);
      return { ok: true, handle };
    }
  } catch (error) {
    // A database hiccup here is not evidence about the handle — fall through to
    // the live lookup rather than rejecting someone over it.
    logger.warning("Handle check could not read local profiles", { error: error.message });
  }

  try {
    const profile = await getInstagramProfile(handle);
    if (!profile || !profile.username) return { ok: false, reason: "not_found" };
    verified.set(handle, Date.now() + CACHE_TTL_MS);
    return { ok: true, handle };
  } catch (error) {
    if (error instanceof ProfileNotFoundError) return { ok: false, reason: "not_found" };
    logger.error("Handle check lookup failed", { error: error.message, handle });
    return { ok: false, reason: "unavailable" };
  }
}

module.exports = { verifyHandle, normalizeHandle };
