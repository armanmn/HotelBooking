import mongoose from "mongoose";

const GlobalSettingsSchema = new mongoose.Schema({
  b2cMarkupPercentage: { type: Number, default: 10 },
  officeMarkupPercentage: { type: Number, default: 10 },
  defaultSalesPartnerMarkup: { type: Number, default: 7 },
  exchangeRates: {
    AMD: { type: Number, default: 1 },
    USD: { type: Number, default: 0 },
    EUR: { type: Number, default: 0 },
    RUB: { type: Number, default: 0 },
  },
});

const GlobalSettings = mongoose.model("GlobalSettings", GlobalSettingsSchema);
export default GlobalSettings;
