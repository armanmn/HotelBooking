import express from "express";
import City from "../models/City.js";
import SupplierCityMap from "../models/SupplierCityMap.js";

const router = express.Router();

function pickQuery(req) {
  // Գրանցենք թե query, թե q որպես ալիաս
  return (req.query.query || req.query.q || "").trim();
}

/**
 * GET /api/v1/meta/cities?query=Par&supplier=goglobal
 * - Եթե supplier կա → կցում ենք supplierCityId-ը (այդ supplier-ի city id mapping-ը)
 * - Չկա supplier → վերադարձնում ենք միայն մեր system city code/name/country
 */
router.get("/cities", async (req, res) => {
  try {
    const q = pickQuery(req);
    const supplier = (req.query.supplier || "").trim();

    let cities;
    if (!q) {
      cities = await City.find({}, { _id: 0, code: 1, name: 1, country: 1 })
        .limit(500)
        .lean();
    } else {
      const rx = new RegExp(q, "i");
      cities = await City.find(
        {
          $or: [
            { name: rx },
            { country: rx },
            { code: new RegExp(`^${q}$`, "i") }, // ամբողջական կոդի համընկնում
          ],
        },
        { _id: 0, code: 1, name: 1, country: 1 }
      )
        .limit(50)
        .lean();
    }

    if (!supplier) {
      return res.json(cities);
    }

    // supplier mapping — մեկ հարցմամբ
    const systemCodes = cities.map((c) => String(c.code));
    const maps = await SupplierCityMap.find({
      provider: supplier,
      systemCityId: { $in: systemCodes },
    })
      .select("systemCityId supplierCityId")
      .lean();

    const m = new Map(maps.map((x) => [String(x.systemCityId), String(x.supplierCityId)]));

    const withSupplier = cities.map((c) => ({
      ...c,
      supplierCityId: m.get(String(c.code)) || null,
    }));

    res.json(withSupplier);
  } catch (e) {
    console.error("GET /meta/cities failed", e);
    res.status(500).json({ error: "failed" });
  }
});

/**
 * GET /api/v1/meta/cities/resolve?name=Paris&supplier=goglobal
 * - Վերադարձնում է 1 արդյունք (կամ 404), supplierCityId-ով, եթե կա mapping
 * - Եթե name թվային է (օր. "563")՝ treat as code lookup
 */
router.get("/cities/resolve", async (req, res) => {
  try {
    const raw = (req.query.name || "").trim();
    if (!raw) return res.status(400).json({ error: "name required" });

    const supplier = (req.query.supplier || "").trim();

    // numeric? try by code
    let doc;
    if (/^\d+$/.test(raw)) {
      doc = await City.findOne(
        { code: raw },
        { _id: 0, code: 1, name: 1, country: 1 }
      ).lean();
    } else {
      doc = await City.findOne(
        { name: new RegExp(`^${raw}$`, "i") },
        { _id: 0, code: 1, name: 1, country: 1 }
      ).lean();
    }

    if (!doc) return res.status(404).json({ error: "not found" });

    if (!supplier) return res.json(doc);

    const map = await SupplierCityMap.findOne({
      provider: supplier,
      systemCityId: String(doc.code),
    })
      .select("supplierCityId")
      .lean();

    return res.json({
      ...doc,
      supplierCityId: map ? String(map.supplierCityId) : null,
    });
  } catch (e) {
    console.error("GET /meta/cities/resolve failed", e);
    res.status(500).json({ error: "failed" });
  }
});

export default router;