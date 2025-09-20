import fs from "fs/promises";
import path from "path";
import mongoose from "mongoose";
// ⬇️ ԱՅՍՏԵՂ
import "dotenv/config";

import City from "../models/City.js";
import SupplierCityMap from "../models/SupplierCityMap.js";

const CITIES_PATH = path.join(process.cwd(), "data/gogl_cities.json");

function maskMongoUri(uri) {
  try {
    return uri.replace(/\/\/([^:]+):([^@]+)@/, "//***:***@");
  } catch {
    return uri;
  }
}

async function run() {
  const mongoUri =
    process.env.MONGO_URI ||
    process.env.MONGODB_URI || // fallback, եթե երբևէ փոխես անունը
    "mongodb://localhost:27017/hotels";

  console.log("🔌 Using Mongo URI:", maskMongoUri(mongoUri));

  await mongoose.connect(mongoUri, {
    serverSelectionTimeoutMS: 10000,
  });

  const raw = await fs.readFile(CITIES_PATH, "utf-8");
  const list = JSON.parse(raw);

  for (const row of list) {
    const code = String(row.CityId);
    const name = row.CityName;
    const country = row.Country;

    await City.updateOne(
      { code },
      { $set: { code, name, country } },
      { upsert: true }
    );

    await SupplierCityMap.updateOne(
      { supplier: "goglobal", supplierCityId: code },
      {
        $set: {
          supplier: "goglobal",
          supplierCityId: code,
          cityCode: code,
          supplierCityName: name,
          lastVerifiedAt: new Date(),
        },
      },
      { upsert: true }
    );
  }

  console.log(`✅ Seeded ${list.length} cities + supplier maps`);
  await mongoose.disconnect();
}

run().catch((e) => {
  console.error("❌ Seed failed:", e);
  process.exit(1);
});