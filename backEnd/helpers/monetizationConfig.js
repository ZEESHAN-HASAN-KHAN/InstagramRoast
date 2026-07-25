const INDIA_COUNTRY_CODE = process.env.INDIA_COUNTRY_CODE || "IN";

// Env flags are read through a helper rather than captured at import time so a
// process restart is all it takes to flip a region — and so tests can toggle
// them. Anything other than an explicit falsy string counts as enabled: a
// deploy that forgets these vars gets the feature it just shipped, rather than
// silently serving unlimited free roasts.
function isTruthy(value, fallback = true) {
  if (value === undefined || value === null || value === "") return fallback;
  return !["false", "0", "off", "no"].includes(String(value).trim().toLowerCase());
}

function isEnabledForIndia() {
  return isTruthy(process.env.MONETIZATION_ENABLED_INDIA);
}

function isEnabledForInternational() {
  return isTruthy(process.env.MONETIZATION_ENABLED_INTERNATIONAL);
}

// An unresolved country (geo lookup failed, private IP, local dev) is treated as
// international — same fallback the pricing helper uses, so gating and pricing
// never disagree about which bucket a visitor is in.
function isMonetizationEnabledForCountry(countryCode) {
  return countryCode === INDIA_COUNTRY_CODE ? isEnabledForIndia() : isEnabledForInternational();
}

// When both regions are off there's nothing to classify, so the session
// middleware can skip the geo lookup, the cookie and the DB row entirely.
function isMonetizationEnabledAnywhere() {
  return isEnabledForIndia() || isEnabledForInternational();
}

module.exports = {
  INDIA_COUNTRY_CODE,
  isEnabledForIndia,
  isEnabledForInternational,
  isMonetizationEnabledForCountry,
  isMonetizationEnabledAnywhere,
};
