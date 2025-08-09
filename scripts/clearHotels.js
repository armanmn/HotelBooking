// This scrept clean all or specific providers hotels and offers
// usage
// node scripts/clearProviderData.js goglobal - concret provider
// node scripts/clearProviderData.js all - all provider

import mongoose from "mongoose";
import dotenv from "dotenv";
import readline from "readline";
import Hotel from "../models/Hotel.js";
import Offer from "../models/Offer.js";

dotenv.config();

const provider = process.argv[2]; // CLI argument

if (!provider) {
  console.error("❌ Please provide a provider. Example: node scripts/clearProviderData.js goglobal OR all");
  process.exit(1);
}

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

function askConfirmation(question) {
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      resolve(answer.toLowerCase());
    });
  });
}

await mongoose.connect(process.env.MONGO_URI);

try {
  let offerCount, hotelCount;

  if (provider === "all") {
    offerCount = await Offer.countDocuments({});
    hotelCount = await Hotel.countDocuments({ partnerType: "external_api" });
  } else {
    offerCount = await Offer.countDocuments({ provider });
    hotelCount = await Hotel.countDocuments({ "externalSource.provider": provider });
  }

  console.log(`\n📊 Preview:`);
  console.log(`   Hotels to delete: ${hotelCount}`);
  console.log(`   Offers to delete: ${offerCount}\n`);

  const answer = await askConfirmation(
    `⚠️ Are you sure you want to delete ${provider === "all" ? "ALL providers" : provider} hotels and offers? (yes/no): `
  );

  if (answer !== "yes") {
    console.log("❌ Operation cancelled.");
    rl.close();
    await mongoose.disconnect();
    process.exit(0);
  }

  let offersDeleted, hotelsDeleted;

  if (provider === "all") {
    offersDeleted = await Offer.deleteMany({});
    hotelsDeleted = await Hotel.deleteMany({ partnerType: "external_api" });
    console.log(`🗑️ Deleted ALL offers (${offersDeleted.deletedCount}) and ALL external_api hotels (${hotelsDeleted.deletedCount})`);
  } else {
    offersDeleted = await Offer.deleteMany({ provider });
    hotelsDeleted = await Hotel.deleteMany({ "externalSource.provider": provider });
    console.log(`🗑️ Deleted ${offersDeleted.deletedCount} offers and ${hotelsDeleted.deletedCount} hotels for provider: ${provider}`);
  }

  console.log(`✅ Completed cleanup for: ${provider}`);
} catch (err) {
  console.error("❌ Error while cleaning:", err);
}

rl.close();
await mongoose.disconnect();
process.exit(0);