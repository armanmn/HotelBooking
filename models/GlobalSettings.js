// models/GlobalSettings.js
import mongoose from "mongoose";

const GlobalSettingsSchema = new mongoose.Schema({
  b2cMarkupPercentage: { type: Number, default: 10 },
  officeMarkupPercentage: { type: Number, default: 10 },
  defaultSalesPartnerMarkup: { type: Number, default: 7 },

  exchangeMode: {
    type: String,
    enum: ["auto", "manual"],
    default: "auto",
  },

  exchangeRates: {
    AMD: { type: Number, default: 1 }, // 1 AMD = 1 AMD
    USD: { type: Number, default: 0 },
    EUR: { type: Number, default: 0 },
    RUB: { type: Number, default: 0 },
    GBP: { type: Number, default: 0 },
  },

  lastRatesUpdateAt: { type: Date, default: null },
  ratesSource: { type: String, default: null }, // օրինակ՝ "CBA/latest.json.php" կամ "manual"
});

const GlobalSettings = mongoose.model("GlobalSettings", GlobalSettingsSchema);
export default GlobalSettings;