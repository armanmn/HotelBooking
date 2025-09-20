// services/exchange/refresh.js
import cron from "node-cron";
import GlobalSettings from "../../models/GlobalSettings.js";
import { fetchCBA } from "./fetchCBA.js";

const TTL_MINUTES = Number(process.env.EXCHANGE_TTL_MINUTES || 360);   // lazy refresh TTL
const DRIFT_MAX   = Number(process.env.EXCHANGE_DRIFT_MAX ?? 0.25);    // 0.25 = 25% guard
const CRON_EXPR   = (process.env.EXCHANGE_CRON || "5 * * * *").replaceAll('"', "");

const MAX_RETRIES = Number(process.env.EXCHANGE_MAX_RETRIES || 5);      // որքան փորձ անել
const RETRY_EVERY_MIN = Number(process.env.EXCHANGE_RETRY_MINUTES || 10); // յուրաքանչյուր X րոպեն մեկ
let retryAttempt = 0;
let retryTimer = null;

function scheduleRetry(force = false) {
  if (force) {
    clearTimeout(retryTimer);
    retryAttempt = 0;
    return;
  }
  if (retryAttempt >= MAX_RETRIES) return;
  const jitter = Math.floor(Math.random() * 3); // +0..2 րոպե
  const delayMs = (RETRY_EVERY_MIN + jitter) * 60_000;
  clearTimeout(retryTimer);
  retryTimer = setTimeout(async () => {
    retryAttempt += 1;
    await fetchAndUpdateRates({ isRetry: true });
  }, delayMs);
}

/**
 * Կտրուկ տատանման guard — վերադարձնում է true, եթե նոր արժեքը OK է, հակառակ դեպքում false
 */
function withinDriftGuard(oldVal, newVal) {
  if (!DRIFT_MAX || DRIFT_MAX <= 0) return true;     // guard-ը անջատված է
  if (!oldVal || oldVal <= 0) return true;           // հիմք չկա, ընդունում ենք
  const rel = Math.abs(newVal - oldVal) / oldVal;    // հարաբերական փոփոխություն
  return rel <= DRIFT_MAX;
}

/**
 * Ստանալ և պահպանել նոր կուրսերը (auto)
 * options: { force?: boolean, isRetry?: boolean }
 */
export async function fetchAndUpdateRates(options = {}) {
  const { force = false, isRetry = false } = options;
  try {
    const gs = await GlobalSettings.findOne({});
    if (!gs) throw new Error("GlobalSettings not found");

    const { rates: newRates, source, fetchedAt } = await fetchCBA();

    if (gs.exchangeMode !== "auto") {
      // Եթե manual է, auto fetch-ը չի գրում rates
      return gs;
    }

    // Guard only in auto mode (եթե force=true, skip guard)
    if (!force) {
      const cur = gs.exchangeRates || {};
      // ստուգում ենք USD/EUR/RUB/GBP ըստ guard-ի
      const keys = ["USD", "EUR", "RUB", "GBP"];
      for (const k of keys) {
        const ok = withinDriftGuard(Number(cur[k] || 0), Number(newRates[k] || 0));
        if (!ok) {
          throw new Error(`DRIFT_GUARD: ${k} change too large (old=${cur[k]}, new=${newRates[k]})`);
        }
      }
    }

    gs.exchangeRates = newRates;            // { AMD:1, USD:..., EUR:..., RUB:..., GBP:... }
    gs.lastRatesUpdateAt = fetchedAt || new Date();
    gs.ratesSource = source || "CBA";
    const saved = await gs.save();

    // հաջողության դեպքում՝ reset retry
    scheduleRetry(true);
    return saved;
  } catch (err) {
    console.error("[exchange] refresh failed:", err?.message || err);
    // fallback — ոչինչ չենք փչացնում, մնում են նախորդ rate-երը
    scheduleRetry(false);
    return null;
  }
}

/**
 * Lazy-refresh՝ վերադարձրու settings-ը,
 * իսկ եթե auto է և TTL-ը հնացել է՝ փորձիր թարմացնել հետնաբեմում
 */
export async function ensureFreshRates() {
  const gs = await GlobalSettings.findOne({});
  if (!gs) return null;

  if (gs.exchangeMode === "auto") {
    const last = gs.lastRatesUpdateAt ? new Date(gs.lastRatesUpdateAt) : null;
    const ageMin = last ? (Date.now() - last.getTime()) / 60000 : Infinity;
    if (ageMin > TTL_MINUTES) {
      // background refresh (չի խանգարում պատասխանին)
      fetchAndUpdateRates().catch(() => {});
    }
  }
  return gs;
}

/**
 * Սկսել cron-ը
 */
export function startExchangeCron() {
  try {
    cron.schedule(CRON_EXPR, async () => {
      await fetchAndUpdateRates();
    });
    console.log(`[exchange] cron scheduled: ${CRON_EXPR}`);
  } catch (e) {
    console.error("[exchange] cron schedule failed:", e);
  }
}