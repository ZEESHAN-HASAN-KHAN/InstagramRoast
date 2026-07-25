// Amounts are in the currency's smallest unit (paise / cents), which is what
// Razorpay's orders API expects.
const INDIA_COUNTRY_CODE = process.env.INDIA_COUNTRY_CODE || "IN";

const INR_PRICE = {
  amount: Number(process.env.PRICE_AMOUNT_INR) || 10000,
  currency: process.env.PRICE_CURRENCY_INR || "INR",
};

const USD_PRICE = {
  amount: Number(process.env.PRICE_AMOUNT_USD) || 199,
  currency: process.env.PRICE_CURRENCY_USD || "USD",
};

// Pure/sync: the country was already resolved once when the session row was
// created (see middleware/session.js), so nothing here touches the network.
// An unresolved country (null) falls into the international bracket.
function getPriceForCountry(countryCode) {
  return countryCode === INDIA_COUNTRY_CODE ? { ...INR_PRICE } : { ...USD_PRICE };
}

const PAID_CREDITS_PER_PURCHASE = Number(process.env.PAID_CREDITS_PER_PURCHASE) || 2;

module.exports = { getPriceForCountry, PAID_CREDITS_PER_PURCHASE };
