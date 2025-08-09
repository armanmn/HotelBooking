// seedGlobalSettings.js
import mongoose from "mongoose";
import dotenv from "dotenv";
import GlobalSettings from "../models/GlobalSettings.js"; // adjust path
dotenv.config();

async function seed() {
  await mongoose.connect(process.env.MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true });

  const defaults = {
    exchangeRates: {
      AMD: 1,
      USD: Number(process.env.USD_DIFF_BASE || 383.94) + Number(process.env.USD_DIFF || 0),
      EUR: Number(process.env.EUR_DIFF_BASE || 450.25) + Number(process.env.EUR_DIFF || 0),
      RUB: Number(process.env.RUB_DIFF_BASE || 4.8453) + Number(process.env.RUB_DIFF || 0),
    },
    b2cMarkupPercentage: Number(process.env.B2C_MARKUP_DEFAULT || 10),
    officeMarkupPercentage: Number(process.env.OFFICE_MARKUP_DEFAULT || 10),
    defaultSalesPartnerMarkup: Number(process.env.SALES_PARTNER_MARKUP_DEFAULT || 7),
  };

  const updated = await GlobalSettings.findOneAndUpdate(
    {},          // empty filter: first (and only) doc
    defaults,
    {
      upsert: true,
      new: true,
      setDefaultsOnInsert: true
    }
  );

  console.log("✅ GlobalSettings seeded/updated:", updated);
  await mongoose.disconnect();
}

seed().catch(err => {
  console.error("Seeding error:", err);
  process.exit(1);
});