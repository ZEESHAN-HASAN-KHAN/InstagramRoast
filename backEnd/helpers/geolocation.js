const logger = require("./logger");

// node-fetch v3 is ESM-only — same dynamic-import wrapper as helpers/apiHelper.js.
const fetch = (...args) =>
  import("node-fetch").then(({ default: fetch }) => fetch(...args));

const LOOKUP_TIMEOUT_MS = Number(process.env.GEOLOCATION_TIMEOUT_MS) || 2000;
const CACHE_TTL_MS = (Number(process.env.GEOLOCATION_CACHE_MINUTES) || 60) * 60 * 1000;
const CACHE_MAX_ENTRIES = Number(process.env.GEOLOCATION_CACHE_MAX) || 5000;

// A resolved-to-nothing lookup. Callers always get this shape, never null, so
// they can destructure without guarding.
const EMPTY_GEO = Object.freeze({ country: null, region: null, city: null });

// IP -> { geo, expires }. Needed because monetization gating asks for a
// visitor's country on every request, including visitors whose region is
// switched off and therefore have no session row to cache it on. ip-api's free
// tier allows ~45 requests/minute, so an uncached lookup per request would trip
// it almost immediately. Bounded so a flood of unique IPs can't grow it forever.
const cache = new Map();

function readCache(ip) {
  const hit = cache.get(ip);
  if (!hit) return undefined;
  if (hit.expires < Date.now()) {
    cache.delete(ip);
    return undefined;
  }
  // Refresh insertion order so the oldest *unused* entry is evicted first.
  cache.delete(ip);
  cache.set(ip, hit);
  return hit.geo;
}

function writeCache(ip, geo) {
  if (cache.size >= CACHE_MAX_ENTRIES) {
    cache.delete(cache.keys().next().value);
  }
  cache.set(ip, { geo, expires: Date.now() + CACHE_TTL_MS });
}

// Resolves an IP to { country, region, city } via ip-api.com. The country picks
// a pricing bracket; region/city scope the discovery feeds ("people near you").
// Every failure mode (timeout, non-200, or ip-api's own {status:"fail"} for
// private/reserved addresses like local dev) collapses to EMPTY_GEO rather than
// throwing — a flaky third party must never block session creation, and a null
// country just falls through to the default price bracket.
async function lookupGeo(ip) {
  if (!ip) return EMPTY_GEO;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), LOOKUP_TIMEOUT_MS);

  try {
    const response = await fetch(
      `http://ip-api.com/json/${encodeURIComponent(ip)}?fields=status,countryCode,regionName,city`,
      { signal: controller.signal }
    );
    if (!response.ok) {
      logger.warning("Geolocation lookup returned non-OK", { ip, status: response.status });
      return EMPTY_GEO;
    }

    const data = await response.json();
    if (data.status !== "success" || !data.countryCode) {
      logger.debug("Geolocation lookup did not resolve a country", { ip, status: data.status });
      return EMPTY_GEO;
    }

    return {
      country: data.countryCode,
      region: data.regionName || null,
      city: data.city || null,
    };
  } catch (error) {
    logger.warning("Geolocation lookup failed", { ip, error: error.message });
    return EMPTY_GEO;
  } finally {
    clearTimeout(timeout);
  }
}

// Loopback / link-local / RFC1918 ranges. ip-api can't resolve these (it answers
// {status:"fail"}), so there's no point spending a request on them.
const PRIVATE_IP = [
  /^127\./, /^10\./, /^192\.168\./, /^169\.254\./,
  /^172\.(1[6-9]|2\d|3[01])\./,
  /^::1$/, /^::$/, /^f[cd][0-9a-f]{2}:/i, /^fe[89ab][0-9a-f]:/i,
];

function isPrivateIp(ip) {
  const normalised = String(ip).replace(/^::ffff:/i, ""); // IPv4-mapped IPv6
  return PRIVATE_IP.some((re) => re.test(normalised));
}

// Cached wrapper — use this on request paths. An unresolved lookup is cached
// too, so a persistently unresolvable IP doesn't retry on every request.
async function lookupGeoCached(ip) {
  if (!ip) return EMPTY_GEO;

  // Local development: no public IP to geolocate, so pricing would always fall
  // to the international bracket and the "near you" feeds would never match.
  // Set DEV_FORCE_COUNTRY=IN (plus DEV_FORCE_REGION / DEV_FORCE_CITY) to
  // exercise those paths. Deliberately ignored whenever the IP is publicly
  // routable, so leaving these set in a deployed environment can't mis-price or
  // mis-locate real visitors.
  const forced = process.env.DEV_FORCE_COUNTRY;
  if (forced && isPrivateIp(ip)) {
    return {
      country: forced.toUpperCase(),
      region: process.env.DEV_FORCE_REGION || null,
      city: process.env.DEV_FORCE_CITY || null,
    };
  }

  const cached = readCache(ip);
  if (cached !== undefined) return cached;

  if (isPrivateIp(ip)) {
    // In production this means the real client IP isn't reaching us — usually a
    // wrong trust-proxy hop count — which silently prices every visitor as
    // international. Worth shouting about outside dev.
    if (process.env.NODE_ENV === "production") {
      logger.warning("Geolocation got a private IP — check TRUST_PROXY_HOPS", { ip });
    }
    writeCache(ip, EMPTY_GEO);
    return EMPTY_GEO;
  }

  const geo = await lookupGeo(ip);
  writeCache(ip, geo);
  return geo;
}

// Country-only view, kept for the pricing/monetization callers that never
// needed the finer granularity.
async function lookupCountryCached(ip) {
  return (await lookupGeoCached(ip)).country;
}

module.exports = { lookupGeo, lookupGeoCached, lookupCountryCached, isPrivateIp, EMPTY_GEO };
