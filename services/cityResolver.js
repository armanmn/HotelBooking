import SupplierCityMap from "../models/SupplierCityMap.js";
import City from "../models/City.js";

/**
 * Մուտք՝ canonical cityCode կամ անվանում։
 * Ելք՝ supplierCityId (string) տվյալ supplier-ի համար։
 */
export async function mapCityForSupplier(input, supplier) {
  if (!input) return null;

  // Եթե թվային/կոդ տեսք ունի՝ treat as canonical code
  const maybeCode = String(input).trim();
  let cityCode = null;

  if (/^\d+$/.test(maybeCode)) {
    cityCode = maybeCode;
  } else {
    // որոնում ենք City by name
    const city = await City.findOne({ name: new RegExp(`^${maybeCode}$`, "i") }).lean();
    if (city) cityCode = city.code;
  }

  if (!cityCode) return null;

  // փնտրում ենք supplier mapping
  const map = await SupplierCityMap.findOne({ supplier, supplierCityId: cityCode }).lean();
  if (map) return map.supplierCityId;

  // fallback: եթե mapping չգտանք, բայց supplier-ը հենց GoGlobal է և հիմա canonical == goglobal,
  // կարող ենք վերադարձնել նույն code-ը՝ backward-compat:
  if (supplier === "goglobal") return cityCode;

  return null;
}