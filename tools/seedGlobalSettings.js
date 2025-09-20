// tools/seedGlobalSettings.js
import mongoose from "mongoose";
import dotenv from "dotenv";
import GlobalSettings from "../models/GlobalSettings.js";
import { fetchCBA } from "../services/exchange/fetchCBA.js";

dotenv.config();

const MONGO_URI = process.env.MONGO_URI;

function manualDefaults() {
  // base + diffs, եթե չես ուզում՝ կարող ես USD_RATE/EUR_RATE/... օգտագործել
  const num = (v, d=0) => (v == null ? d : Number(v));
  const base = {
    USD: num(process.env.USD_DIFF_BASE || 383.94) + num(process.env.USD_DIFF || 0),
    EUR: num(process.env.EUR_DIFF_BASE || 450.25) + num(process.env.EUR_DIFF || 0),
    RUB: num(process.env.RUB_DIFF_BASE || 4.8453) + num(process.env.RUB_DIFF || 0),
    GBP: num(process.env.GBP_DIFF_BASE || 490) + num(process.env.GBP_DIFF || 0),
  };
  return { AMD: 1, ...base };
}

async function seed() {
  await mongoose.connect(MONGO_URI);

  const isAuto = process.argv.includes("--auto");

  let exchangeRates = manualDefaults();
  let exchangeMode = "manual";
  let fetchedAt = new Date();
  let source = "manual(seed)";

  if (isAuto) {
    const auto = await fetchCBA();
    exchangeRates = auto.rates;
    exchangeMode = "auto";
    fetchedAt = auto.fetchedAt;
    source = auto.source;
  }

  const defaults = {
    exchangeMode,
    exchangeRates,
    lastRatesUpdateAt: fetchedAt,
    ratesSource: source,
    b2cMarkupPercentage: Number(process.env.B2C_MARKUP_DEFAULT || 10),
    officeMarkupPercentage: Number(process.env.OFFICE_MARKUP_DEFAULT || 10),
    defaultSalesPartnerMarkup: Number(process.env.SALES_PARTNER_MARKUP_DEFAULT || 7),
  };

  const updated = await GlobalSettings.findOneAndUpdate(
    {},
    defaults,
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );

  console.log("✅ GlobalSettings seeded/updated:", {
    exchangeMode: updated.exchangeMode,
    exchangeRates: updated.exchangeRates,
    lastRatesUpdateAt: updated.lastRatesUpdateAt,
    ratesSource: updated.ratesSource,
  });

  await mongoose.disconnect();
}

seed().catch(err => {
  console.error("❌ Seeding error:", err);
  process.exit(1);
});