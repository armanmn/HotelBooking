import mongoose from "mongoose";
import GlobalSettings from "../models/GlobalSettings.js";
import dotenv from "dotenv";
dotenv.config();

async function run() {
  await mongoose.connect(process.env.MONGO_URI);

//   const settings = await GlobalSettings.findOne();
//   if (!settings) throw new Error("No GlobalSettings found");

  settings.exchangeRates = {
    AMD: 1,
    USD: 0,
    EUR: 0,
    RUB: 0,
  };

  await settings.save();
  console.log("✅ Updated exchangeRates:", settings.exchangeRates);
  process.exit(0);
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});