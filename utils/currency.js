// utils/currency.js

export function resolveEffectiveCurrency({ queryCurrency, userCurrency, defaultCurrency }) {
  const cur = (queryCurrency || userCurrency || defaultCurrency || "").trim().toUpperCase();
  if (!cur) {
    const err = new Error("Currency is required but not provided.");
    err.status = 400;
    throw err;
  }
  return cur;
}