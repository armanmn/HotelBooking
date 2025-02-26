import mongoose from "mongoose";

const GlobalSettingsSchema = new mongoose.Schema({
  b2cMarkupPercentage: { type: Number, default: 10 }, // ✅ B2C-ի markup տոկոսը (default 10%)
  exchangeRates: {
    USD: { type: Number, default: 1 }, // ✅ Դոլարի փոխարժեք (հիմնական արժույթը՝ AMD)
    EUR: { type: Number, default: 1 }, // ✅ Եվրոյի փոխարժեք
    RUB: { type: Number, default: 1 }, // ✅ Ռուբլու փոխարժեք
  },
});

const GlobalSettings = mongoose.model("GlobalSettings", GlobalSettingsSchema);
export default GlobalSettings;