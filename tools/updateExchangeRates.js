// tools/updateExchangeRates.js
import mongoose from "mongoose";
import dotenv from "dotenv";
import GlobalSettings from "../models/GlobalSettings.js";
import { fetchCBA } from "../services/exchange/fetchCBA.js";

dotenv.config();

const MONGO_URI = process.env.MONGO_URI;

function readManualFromEnv() {
  const num = (v, d=0) => (v == null ? d : Number(v));
  return {
    AMD: 1,
    USD: num(process.env.USD_RATE),
    EUR: num(process.env.EUR_RATE),
    RUB: num(process.env.RUB_RATE),
    GBP: num(process.env.GBP_RATE),
  };
}

async function run() {
  await mongoose.connect(MONGO_URI);

  const settings = await GlobalSettings.findOne() || new GlobalSettings();

  const isAuto = process.argv.includes("--auto");

  if (isAuto) {
    const { rates, source, fetchedAt } = await fetchCBA();
    settings.exchangeMode = "auto";
    settings.exchangeRates = rates;
    settings.lastRatesUpdateAt = fetchedAt;
    settings.ratesSource = source;
  } else {
    const rates = readManualFromEnv(); // օգտագործիր ENV՝ USD_RATE/EUR_RATE/RUB_RATE/GBP_RATE
    settings.exchangeMode = "manual";
    settings.exchangeRates = rates;
    settings.lastRatesUpdateAt = new Date();
    settings.ratesSource = "manual";
  }

  await settings.save();
  console.log("✅ Updated exchangeRates:", settings.exchangeRates, "mode:", settings.exchangeMode);
  process.exit(0);
}

run().catch(err => {
  console.error("❌ updateExchangeRates failed:", err);
  process.exit(1);
});