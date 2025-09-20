// services/exchange/fetchCBA.js
import axios from "axios";

/**
 * Բերում ենք ԿԲԱ-ի վերջին փոխարժեքները (AMD հիմք է).
 * Վերադարձնում է { rates, source, fetchedAt }.
 * rates արժեքները՝ AMD, USD, EUR, RUB, GBP  (բոլորը՝ Number, AMD=1).
 * env դիֆերը (USD_DIFF/EUR_DIFF/RUB_DIFF/GBP_DIFF) գումարում ենք ապահովորեն։
 */
export async function fetchCBA() {
  const url = "https://cb.am/latest.json.php";
  const resp = await axios.get(url, { timeout: 10000 });
  const data = resp?.data || {};

  const n = (v) => {
    const x = Number(v);
    return Number.isFinite(x) ? x : NaN;
  };
  const withDiff = (v, envKey) => {
    const base = n(v);
    const diff = Number(process.env[envKey] || 0);
    return Number.isFinite(base) ? base + diff : NaN;
  };

  // ԿԲԱ վերադարձնում է 1 FX = ? AMD
  // AMD = 1 (սարքած կոնվենցիա)
  const rates = {
    AMD: 1,
    USD: withDiff(data["USD"], "USD_DIFF"),
    EUR: withDiff(data["EUR"], "EUR_DIFF"),
    RUB: withDiff(data["RUB"], "RUB_DIFF"),
    GBP: withDiff(data["GBP"], "GBP_DIFF"),
  };

  return {
    rates,
    source: "CBA/latest.json.php",
    fetchedAt: new Date(),
  };
}