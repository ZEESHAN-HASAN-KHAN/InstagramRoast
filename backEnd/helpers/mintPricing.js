// Pricing for First Mint claims — a separate ladder from the roast-credit price
// in pricing.js, because the two are selling different things. Credits buy an
// LLM run; a claim buys a permanent public row and costs nothing to fulfil, so
// it is priced as an impulse rather than against cost.
//
// The ladder descends with the mint number: mint #1 of a handle is the scarce
// one and the only one that can ever say "first on earth", so it carries the
// premium. Everything past #3 sits on a floor price.
//
// Amounts are in the currency's smallest unit (paise / cents) — same convention
// as pricing.js, and what both gateways expect.
//
// ⚠️ On the international floor: PayPal's standard rate is roughly
// $0.49 fixed + 3.49%, so any USD claim under about $0.99 is sold at a loss.
// The $0.30 and $0.50 rungs below are the owner's chosen ladder and are left as
// specified — raise MINT_PRICE_USD_3 / MINT_PRICE_USD_REST to 99 if the PayPal
// fee report confirms the bleed. Razorpay is ~2% + GST, so the INR rungs are
// fine all the way down to ₹19.
const INDIA_COUNTRY_CODE = process.env.INDIA_COUNTRY_CODE || "IN";

const num = (value, fallback) => Number(value) || fallback;

// Indexed by mint number, with the last entry acting as the floor for every
// mint beyond it. Read at call time rather than captured at import so a price
// change is a process restart, not a rebuild — same rationale as
// monetizationConfig.js.
function ladderFor(currency) {
  if (currency === "INR") {
    return [
      num(process.env.MINT_PRICE_INR_1, 10000),
      num(process.env.MINT_PRICE_INR_2, 4900),
      num(process.env.MINT_PRICE_INR_3, 2900),
      num(process.env.MINT_PRICE_INR_REST, 1900),
    ];
  }
  return [
    num(process.env.MINT_PRICE_USD_1, 150),
    num(process.env.MINT_PRICE_USD_2, 100),
    num(process.env.MINT_PRICE_USD_3, 50),
    num(process.env.MINT_PRICE_USD_REST, 30),
  ];
}

function currencyForCountry(countryCode) {
  return countryCode === INDIA_COUNTRY_CODE
    ? process.env.PRICE_CURRENCY_INR || "INR"
    : process.env.PRICE_CURRENCY_USD || "USD";
}

// Pure/sync, like getPriceForCountry: the country was resolved once when the
// session row was created. An unresolved country falls into the international
// bracket, matching pricing.js so gating and pricing never disagree.
function getMintPrice(countryCode, mintNo) {
  const currency = currencyForCountry(countryCode);
  const ladder = ladderFor(currency);
  // A missing or nonsensical mint number would otherwise index past the array
  // and hand back `undefined` as an amount, which the gateway rejects with a
  // useless error. Clamp to the floor instead.
  const index = Number.isInteger(mintNo) && mintNo >= 1
    ? Math.min(mintNo, ladder.length) - 1
    : ladder.length - 1;
  return { amount: ladder[index], currency };
}

module.exports = { getMintPrice, currencyForCountry };
