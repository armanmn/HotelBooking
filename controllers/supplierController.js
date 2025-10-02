// controllers/supplierController.js
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

import GlobalSettings from "../models/GlobalSettings.js";
import Hotel from "../models/Hotel.js";
import {
  hotelSearchAvailability,
  bookingValuation,
  hotelInfo,
} from "../services/goglobalClient.js";
import { signOfferProof, verifyOfferProof } from "../utils/offerProof.js";

/* ----------------------------- Utils / helpers ----------------------------- */

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const SAFETY_BUFFER_DAYS = Number(process.env.BOOKING_SAFETY_BUFFER_DAYS || 4);

// Offer-proof requirement flag (true/1/yes/on)
const REQUIRE_PROOF = /^(true|1|yes|on)$/i.test(
  String(process.env.OFFER_PROOF_REQUIRED || "")
);

function stripCdata(s) {
  return String(s || "").replace(/^<!\[CDATA\[|\]\]>$/g, "");
}

function cleanSupplierHtml(s) {
  return String(s || "")
    .replace(/^<!\[CDATA\[|\]\]>$/g, "")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&");
}

// ---- GoGlobal defaults from env (with safe fallbacks)
const envInt = (k, d) => {
  const n = Number(process.env[k]);
  return Number.isFinite(n) && n > 0 ? n : d;
};
const GG_DEFAULTS = {
  MAX_HOTELS: envInt("GG_MAX_HOTELS", 150),
  MAX_OFFERS: envInt("GG_MAX_OFFERS", 5),
  MAX_WAITTIME: envInt("GG_MAX_WAITTIME", 15),
};

function computeCancelSafety({
  supplierDeadline, // string | null
  supplierRefundable, // true | false | null
  now = Date.now(),
  bufferDays = SAFETY_BUFFER_DAYS,
}) {
  const d = supplierDeadline ? new Date(supplierDeadline) : null;
  const hasDeadline = d && !isNaN(d.getTime());
  const supplierDeadlineUtc = hasDeadline ? d.toISOString() : null;

  const cutoffMs = hasDeadline
    ? d.getTime() - bufferDays * 24 * 3600 * 1000
    : null;
  const platformCutoffUtc = cutoffMs ? new Date(cutoffMs).toISOString() : null;

  // Customer-facing refundable = supplier refundable ԵՎ cutoff-ը դեռ չի անցել
  const platformRefundable = Boolean(
    supplierRefundable === true && cutoffMs && now < cutoffMs
  );

  return {
    // Nested views
    supplier: {
      refundable: supplierRefundable === true,
      deadlineUtc: supplierDeadlineUtc,
    },
    platform: {
      refundable: platformRefundable,
      cutoffUtc: platformCutoffUtc,
      bufferDays,
      reason:
        supplierRefundable === false
          ? "NON_REFUNDABLE_SUPPLIER"
          : hasDeadline
          ? platformRefundable
            ? null
            : "NON_REFUNDABLE_PLATFORM_BUFFER"
          : "NO_DEADLINE",
    },

    // Metrics & legacy convenience
    hoursUntilSupplierDeadline: hasDeadline
      ? Math.floor((d.getTime() - now) / 3600000)
      : null,

    // Legacy flat fields (keep old UI safe)
    refundable: supplierRefundable === true,
    supplierDeadlineUtc,
    platformCutoffUtc,
    safeToBook: platformRefundable,
    bufferDays,
  };
}

// data/gogl_cities.json — supplier CityId → CityName/Country
const CITIES_PATH = path.resolve(__dirname, "../data/gogl_cities.json");
let CITY_MAP = null;
function loadCityMap() {
  if (CITY_MAP) return CITY_MAP;
  try {
    const raw = fs.readFileSync(CITIES_PATH, "utf8");
    const arr = JSON.parse(raw);
    CITY_MAP = new Map(arr.map((c) => [String(c.CityId), c]));
  } catch (_e) {
    CITY_MAP = new Map();
  }
  return CITY_MAP;
}
function cityFromId(cityId) {
  if (!cityId) return null;
  const m = loadCityMap();
  return m.get(String(cityId)) || null;
}

const toNum = (v, d = 0) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : d;
};

// Role-based markup
async function getRoleMarkupPct(req) {
  const settings = await GlobalSettings.findOne({});
  const b2cPct = toNum(settings?.b2cMarkupPercentage, 0);
  const officePct = toNum(settings?.officeMarkupPercentage, 0);
  const defaultSPPct = toNum(settings?.defaultSalesPartnerMarkup, 0);

  const role = req.user?.role || "guest";
  if (role === "b2c" || role === "guest") return b2cPct;
  if (role === "office_user") return officePct;
  if (role === "b2b_sales_partner") {
    return req.user?.markupPercentage ?? defaultSPPct;
  }
  return 0;
}

function mapBoard(code) {
  const m = {
    RO: "Room Only",
    BB: "Bed & Breakfast",
    HB: "Half Board",
    FB: "Full Board",
    AI: "All Inclusive",
  };
  return m[code] || code || null;
}

// 👇 helper՝ Rooms -> [room names]
function getRoomNames(o) {
  if (Array.isArray(o?.Rooms)) {
    return o.Rooms.map((x) => String(x || "").trim()).filter(Boolean);
  }
  if (typeof o?.Rooms === "string" && o.Rooms.trim()) {
    return [o.Rooms.trim()];
  }
  if (o?.RoomName && String(o.RoomName).trim()) return [String(o.RoomName).trim()];
  if (o?.roomName && String(o.roomName).trim()) return [String(o.roomName).trim()];
  return [];
}

function extractRoomNamesFromOffer(o) {
  // Supplier normally returns an array in o.Rooms; sometimes a single string.
  const rawList = Array.isArray(o?.Rooms)
    ? o.Rooms
    : (typeof o?.Rooms === "string" && o.Rooms.trim())
    ? [o.Rooms.trim()]
    : [];

  const list = rawList
    .map((s) => cleanSupplierHtml(String(s || "").trim()))
    .filter(Boolean);

  // Fallbacks when Rooms is missing
  if (!list.length) {
    const single =
      (o?.RoomName && String(o.RoomName).trim()) ||
      (o?.roomName && String(o.roomName).trim()) ||
      "";
    if (single) list.push(cleanSupplierHtml(single));
  }

  return list;
}

// պահում ենք նաև հինը՝ հետադարձ համատեղելիության համար
function pickRoomName(o) {
  const list = getRoomNames(o);
  return list.length ? list[0] : null;
}

function mapOffer(o) {
  const amount =
    toNum(o?.TotalPrice) ||
    toNum(o?.Price?.Total) ||
    toNum(o?.Price) ||
    toNum(o?.amount);
  const currency = o?.Currency || o?.Price?.Currency || o?.currency;
  if (!amount || !currency) return null;

  const nonRefFlag = o?.NonRef === true;
  const refundableFlag = o?.Refundable;
  const supplierDeadline =
    o?.CxlDeadLine || o?.CxlDeadline || o?.CancelDeadline || null;

  let supplierRefundable = null;
  if (nonRefFlag === true) supplierRefundable = false;
  else if (refundableFlag === false) supplierRefundable = false;
  else if (refundableFlag === true) supplierRefundable = true;
  else if (supplierDeadline) supplierRefundable = true;
  else supplierRefundable = null;

  const safety = computeCancelSafety({
    supplierDeadline,
    supplierRefundable,
  });

  // --- NEW: multi-room names
  const roomNamesArr = extractRoomNamesFromOffer(o);      // ["Standard ...", "Single ..."]
  const roomsCount = roomNamesArr.length || null;
  const combinedRoomName =
    roomNamesArr.length > 1 ? roomNamesArr.join(" + ") : (roomNamesArr[0] || null);

  // Remarks (decoded HTML)
  const remarksHtmlRaw = o?.Remark || o?.Remarks || null;
  const remarksHtml = remarksHtmlRaw ? cleanSupplierHtml(remarksHtmlRaw) : null;
  const preferred = o?.Preferred === true;

  return {
    price: { amount, currency },      // supplier NET
    board: mapBoard(o?.RoomBasis),
    refundable: safety.refundable,    // legacy
    cxlDeadline: supplierDeadline,    // legacy
    cancellation: safety,             // structured
    searchCode: o?.HotelSearchCode || o?.SearchCode || o?.rateToken || null,
    category: toNum(o?.Category, 0),

    // 🔁 Legacy single name kept, but now a **combined** label for multi-room offers
    roomName: combinedRoomName,

    // ✨ NEW explicit composition
    roomNames: roomNamesArr,
    roomsCount,

    // extras
    remarksHtml,
    preferred,
  };
}

function pickMinOffer(offers = []) {
  let best = null;
  for (const o of offers) {
    const m = mapOffer(o);
    if (!m) continue;
    if (!best || m.price.amount < best.price.amount) best = m;
  }
  return best;
}

function normalizeAvailability(raw, maxOffersPreview = 5) {
  const hotels = Array.isArray(raw)
    ? raw
    : raw?.Hotels || raw?.Data?.Hotels || raw?.data?.Hotels || [];

  const out = [];
  for (const h of hotels) {
    const offersArr = h?.Offers || h?.Rooms || h?.rates || h?.offers || [];
    const mappedOffers = offersArr.map(mapOffer).filter(Boolean);

    if (mappedOffers.length === 0) continue;

    // sort by NET ascending
    mappedOffers.sort((a, b) => a.price.amount - b.price.amount);

    const min = mappedOffers[0];
    const stars =
      toNum(h?.Stars) || toNum(h?.Category) || toNum(min?.category) || 0;

    const images = [];
    if (h?.HotelImage) images.push({ url: h.HotelImage, isMain: true });

    out.push({
      _id: String(h?.HotelCode ?? ""), // provider hotel code
      name: h?.HotelName || h?.Name || "Hotel",
      stars,
      thumbnail: h?.Thumbnail || null,
      images,
      rating: 0,
      reviewsCount: 0,
      externalRating: null,
      location: {
        city: h?.CityName || null,
        country: h?.CountryName || null,
        address: h?.Location || null,
        lat: toNum(h?.Latitude, null),
        lng: toNum(h?.Longitude, null),
      },
      externalSource: {
        provider: "goglobal",
        hotelCode: String(h?.HotelCode ?? ""),
        cityId: String(h?.CityId ?? h?.CityCode ?? ""),
      },

      // provider NET prices
      minOffer: min,
      offersPreview: mappedOffers.slice(0, maxOffersPreview),
    });
  }

  return out;
}

function normalizeValuation(raw, fallbackCurrency) {
  // ---------- JSON case ----------
  if (raw && !raw.__rawXml) {
    const v = raw?.Valuation || raw?.Data || raw || {};
    const amount =
      toNum(v?.FinalPrice) ||
      toNum(v?.Price?.Total) ||
      toNum(v?.Price) ||
      toNum(v?.Amount) ||
      0;

    const currency =
      v?.Currency ||
      v?.Price?.Currency ||
      v?.Money?.Currency ||
      fallbackCurrency ||
      null;

    const cancellationDeadline =
      v?.CancellationDeadline ||
      v?.CancelDeadline ||
      v?.CxlDeadLine ||
      v?.CxlDeadline ||
      null;

    const remarks = v?.Remarks || v?.Notes || v?.remarks || null;

    if (amount && currency) {
      return { price: { amount, currency }, cancellationDeadline, remarks };
    }
    // unchanged → no rate returned
    return { price: null, cancellationDeadline, remarks };
  }

  // ---------- XML case ----------
  const xml = String(raw?.__rawXml || "");
  if (!xml) throw new Error("Supplier valuation missing payload.");

  // Supplier <Error ...>
  const err = xml.match(
    /<Error\b[^>]*code="(\d+)"[^>]*>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/Error>/i
  );
  if (err) {
    const code = err[1];
    const msg = (err[2] || "").trim() || "Unknown supplier error";
    throw new Error(`Supplier Error ${code}: ${msg}`);
  }

  const pick = (tag) => {
    const m = xml.match(new RegExp(`<${tag}>([\\s\\S]*?)<\\/${tag}>`, "i"));
    return m ? m[1].trim() : null;
  };
  const attrFrom = (attrsStr, nameRegex) => {
    const m = String(attrsStr || "").match(
      new RegExp(`${nameRegex}\\s*=\\s*"([^"]+)"`, "i")
    );
    return m ? m[1] : null;
  };
  const pickTagWithAttrs = (tags) => {
    for (const tag of tags) {
      const m = xml.match(
        new RegExp(`<${tag}([^>]*)>([\\s\\S]*?)<\\/${tag}>`, "i")
      );
      if (m) return { tag, attrs: m[1] || "", inner: (m[2] || "").trim() };
    }
    return null;
  };

  // 1) classic price tags
  let priceNode =
    pickTagWithAttrs(["FinalPrice"]) ||
    pickTagWithAttrs(["TotalPrice"]) ||
    pickTagWithAttrs(["Price"]);
  let amountStr = null;
  let currency = null;

  if (priceNode) {
    amountStr = priceNode.inner || null;
    currency =
      attrFrom(priceNode.attrs, "(?:Currency|CurrencyId|Curr|CurrCode)") ||
      null;
  }

  // 2) Valuation v2.0 — <Rates ...>...</Rates>
  const ratesMatches = [
    ...xml.matchAll(/<Rates\b([^>]*)>([\s\S]*?)<\/Rates>/gi),
  ];
  if ((!amountStr || !currency) && ratesMatches.length) {
    // a) <Rates currency="EUR">123.45</Rates>
    for (const m of ratesMatches) {
      const attrs = m[1] || "";
      const inner = (m[2] || "").trim();
      const curAttr = attrFrom(attrs, "(?:currency|Currency|Curr|CurrCode)");
      const amt = inner.replace(/,/g, ".").replace(/[^\d.]/g, "");
      if (curAttr && amt && /^\d+(\.\d+)?$/.test(amt)) {
        currency = curAttr.toUpperCase();
        amountStr = amt;
        break;
      }
    }
    // b) <Rates>145.5 EUR</Rates>
    if (!amountStr || !currency) {
      for (const m of ratesMatches) {
        const inner = (m[2] || "").trim();
        const m2 = inner.match(/([0-9]+(?:[.,][0-9]+)?)\s*([A-Za-z]{3})/);
        if (m2) {
          amountStr = m2[1];
          currency = m2[2].toUpperCase();
          break;
        }
      }
    }
  }

  // 3) cancellation + remarks
  const cxl =
    pick("CancellationDeadline") ||
    pick("CancelDeadline") ||
    pick("CxlDeadLine") ||
    pick("CxlDeadline") ||
    null;

  const remarks =
    pick("Remarks") ||
    pick("Notes") ||
    xml.match(/<!\[CDATA\[([\s\S]*?)\]\]>/)?.[1] ||
    null;

  // 4) unchanged → price not returned → null
  if (!amountStr || !currency) {
    return { price: null, cancellationDeadline: cxl, remarks };
  }

  const amountNum = toNum(
    (amountStr || "").replace(/,/g, ".").replace(/[^\d.]/g, "")
  );
  const stripCdata = (s) => String(s || "").replace(/^<!\[CDATA\[|\]\]>$/g, "");
  const remarksHtml = stripCdata(remarks);
  // optional text version if ever needed
  // const remarksText = remarksHtml.replace(/<br\s*\/?>/gi, "\n").replace(/<\/?[^>]+>/g, "").trim();

  return {
    price: amountNum && currency ? { amount: amountNum, currency } : null,
    cancellationDeadline: cxl,
    remarks: remarksHtml,
  };
}

// --------- Slim hotel-info helper (JSON-first, XML fallback) ---------
function _coerceArr(x) {
  return Array.isArray(x) ? x : x ? [x] : [];
}
function _stripCdata(s) {
  return String(s || "").replace(/^<!\[CDATA\[|\]\]>$/g, "");
}
function _unescapeEntities(s) {
  return String(s || "")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&");
}
function _cleanText(s) {
  return _unescapeEntities(_stripCdata(s));
}
function _pickTag(xml, tag) {
  const m = String(xml).match(new RegExp(`<${tag}>([\\s\\S]*?)<\\/${tag}>`, "i"));
  return m ? m[1].trim() : "";
}

/**
 * Returns a **slim** info object we can inject into availability cards:
 * { name, address, category, descriptionHtml, facilitiesHtml, roomFacilitiesHtml, pictures[] }
 */
async function getSlimHotelInfo(hotelId, lang = "en") {
  const payload = await hotelInfo({
    hotelId,
    language: lang,
    responseFormat: "JSON",
  });

  // ---- JSON case
  const Main = payload?.Main || payload?.Root?.Main;
  if (Main) {
    const nameRaw = Main.HotelName || "";
    const addressRaw = Main.Address || "";
    const category = Number(Main.Category) || 0;

    const descriptionHtml = _stripCdata(Main.Description || "");
    const facilitiesHtml = _stripCdata(Main.HotelFacilities || "");
    const roomFacilitiesHtml = _stripCdata(Main.RoomFacilities || "");

    const picNodes = Main?.Pictures?.Picture;
    const pictures = _coerceArr(picNodes)
      .map((p, i) => {
        const raw = (p?._ || p["#text"] || p.text || p.url || "").toString();
        const url = raw.replace(/<\/?[^>]+>/g, "").trim();
        const isMain =
          /primary|main/i.test(String(p?.$?.Description || "")) || i === 0;
        return url ? { url, isMain } : null;
      })
      .filter(Boolean);

    return {
      name: _cleanText(nameRaw),
      address: _cleanText(addressRaw),
      category,
      descriptionHtml,
      facilitiesHtml,
      roomFacilitiesHtml,
      pictures,
    };
  }

  // ---- XML fallback
  const xml = payload?.__rawXml || "";
  if (!xml) {
    return {
      name: "",
      address: "",
      category: 0,
      descriptionHtml: "",
      facilitiesHtml: "",
      roomFacilitiesHtml: "",
      pictures: [],
    };
  }

  const name = _cleanText(_pickTag(xml, "HotelName"));
  const address = _cleanText(_pickTag(xml, "Address"));
  const category = Number(_cleanText(_pickTag(xml, "Category"))) || 0;

  const descriptionHtml = _unescapeEntities(_pickTag(xml, "Description"));
  const facilitiesHtml = _unescapeEntities(_pickTag(xml, "HotelFacilities"));
  const roomFacilitiesHtml = _unescapeEntities(_pickTag(xml, "RoomFacilities"));

  const picsBlock = xml.match(/<Pictures>([\s\S]*?)<\/Pictures>/i)?.[1] ?? "";
  const urls = Array.from(picsBlock.matchAll(/<!\[CDATA\[([^\]]+)\]\]>/g)).map(
    (m) => m[1].trim()
  );
  const pictures = urls.map((u, i) => ({ url: u, isMain: i === 0 }));

  return { name, address, category, descriptionHtml, facilitiesHtml, roomFacilitiesHtml, pictures };
}

/* -------------------------------- Controllers -------------------------------- */

// GET /api/v1/suppliers/goglobal/availability
export const goglobalAvailability = async (req, res) => {
  try {
    // --- Debug role overrides for Swagger testing (optional) ---
    const debugRole = req.headers["x-debug-role"];
    if (debugRole) {
      req.user = req.user || {};
      req.user.role = debugRole; // 'guest' | 'b2c' | 'office_user' | 'b2b_sales_partner'
      if (debugRole === "b2b_sales_partner" && req.headers["x-debug-markup"]) {
        req.user.markupPercentage = Number(req.headers["x-debug-markup"]);
      }
    }
    const isOfficeRole = (role) =>
      ["office_user", "admin", "finance"].includes(String(role || "").toLowerCase());
    const office = isOfficeRole(req.user?.role);

    const {
      cityId,
      arrivalDate,
      nights,
      currency,            // optional: meta only (SOAP-ին չենք ուղարկում)
      nationality,
      rooms = "1",
      adults = "2",        // կարող է լինել "2" կամ CSV "2,2"
      children = "0",      // idem: "0" կամ CSV "0,1"
      childrenAges = "",   // "5,9" կամ per-room՝ "5|9,11"
      maxHotels,
      maxOffers,
      maximumWaitTime,

      // ✨ ՆՈՐ՝ նույնը ինչ /hotel-availability-ում
      filterBasis = "",    // օրինակ "BB,HB"

      // ✨ ՆՈՐ՝ FE ֆիլտր/սորտ
      minStars,
      maxStars,
      priceMin,
      priceMax,
      sort,                // price_asc | price_desc | stars_desc | stars_asc | name_asc

      // enrichment flags
      includeInfo,
      infoLimit,
      infoLang,
      lang,
    } = req.query;

    if (!cityId || !arrivalDate || !nights) {
      return res.status(400).json({ message: "cityId, arrivalDate, nights are required" });
    }

    // ✅ SOFT currency resolve (meta only). SOAP-ին չե՞նք ուղարկում.
    const settingsDoc = await GlobalSettings.findOne({}).lean();
    const defaultCurrency = (
      settingsDoc?.defaultCurrency ||
      process.env.DEFAULT_CURRENCY ||
      ""
    ).toString().toUpperCase();
    const softResolveCurrency = (q, u, d) => {
      const c = (q || u || d || "").toString().toUpperCase();
      return /^[A-Z]{3}$/.test(c) ? c : null;
    };
    const effectiveCurrency = softResolveCurrency(
      currency,
      req.user?.preferredCurrency,
      defaultCurrency
    );

    /* ----------------- PER-ROOM PAX BUILD (CSV-aware) ----------------- */
    const roomCount = Math.max(1, Number(rooms) || 1);

    // A/C՝ CSV կամ single
    const A = String(adults).split(",").map((n) => Number(n || 0));
    const C = String(children).split(",").map((n) => Number(n || 0));

    // Children ages՝ եթե "|" չկա, ընկալում ենք որպես մեկ խմբի age-ներ և fallback-ով տարածում ենք սենյակների վրա
    const rawAges = String(childrenAges || "");
    const ageGroups = rawAges
      ? (rawAges.includes("|")
          ? rawAges.split("|").map((g) => g.split(",").map((x) => Number(x || 0)))
          : [rawAges.split(",").map((x) => Number(x || 0))])
      : [];

    const pax = Array.from({ length: roomCount }).map((_, i) => {
      const ad = A[i] ?? A[0] ?? 2;
      const ch = C[i] ?? C[0] ?? 0;
      const agesForRoom = (ageGroups[i] || ageGroups[0] || []).slice(0, ch);
      return { adults: ad, childrenAges: agesForRoom, roomCount: 1 };
    });

    /* ----------------- Supplier call ----------------- */
    const raw = await hotelSearchAvailability({
      cityId: String(cityId),
      arrivalDate,
      nights: Number(nights),
      pax,
      nationality,
      maxHotels: Number(maxHotels) || Number(process.env.GG_MAX_HOTELS || 150),
      maxOffers: Number(maxOffers) || Number(process.env.GG_MAX_OFFERS || 5),
      maximumWaitTime:
        Number(maximumWaitTime) || Number(process.env.GG_MAX_WAIT_SECONDS || 15),
      // ✨ փոխանցում ենք filterBasis-ը SOAP-ին
      filterBasis: String(filterBasis)
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean),
      responseFormat: "JSON",
    });

    // 1) supplier JSON → normalized
    const normalized = normalizeAvailability(raw, Number(maxOffers) || 5);

    // 2) hydrate from our DB by providerHotelId
    const codes = normalized
      .map((h) => String(h.externalSource?.hotelCode || h._id))
      .filter(Boolean);

    const dbHotels = await Hotel.find({
      "externalSource.provider": "goglobal",
      "externalSource.providerHotelId": { $in: codes },
    })
      .select(
        "externalSource.providerHotelId externalSource.cityId name stars thumbnail images location rating reviewsCount externalRating"
      )
      .lean();

    const dbMap = new Map(dbHotels.map((x) => [String(x.externalSource.providerHotelId), x]));

    // 3) merge normalized + DB + cityId→CityName fallback
    const enriched = normalized.map((h) => {
      const code = String(h.externalSource?.hotelCode || h._id);
      const db = dbMap.get(code);

      const mergedImages = (h.images?.length ? h.images : db?.images || []).map(
        (img) => (img?.url ? img : { url: img })
      );

      const cid =
        h.externalSource?.cityId ||
        db?.externalSource?.cityId ||
        String(cityId);
      const cityRec = cityFromId(cid);

      return {
        ...h,
        name: h.name || db?.name || h.name,
        stars: h.stars && h.stars > 0 ? h.stars : db?.stars ?? 0,
        thumbnail: h.thumbnail || db?.thumbnail || null,
        images: mergedImages,
        rating: h.rating ?? db?.rating ?? 0,
        reviewsCount: h.reviewsCount ?? db?.reviewsCount ?? 0,
        externalRating: h.externalRating ?? db?.externalRating ?? null,
        location: {
          city: h.location?.city || db?.location?.city || cityRec?.CityName || null,
          country: h.location?.country || db?.location?.country || cityRec?.Country || null,
          address: h.location?.address || db?.location?.address || null,
          lat: h.location?.lat ?? db?.location?.coordinates?.lat ?? db?.location?.lat ?? null,
          lng: h.location?.lng ?? db?.location?.coordinates?.lng ?? db?.location?.lng ?? null,
        },
        externalSource: { ...h.externalSource, cityId: cid },
      };
    });

    // 4) Add cancellation (supplier vs platform) and redact for non-office roles
    const bufferDays = Number(process.env.BOOKING_SAFETY_BUFFER_DAYS || 4) || 4;

    const redactCancellation = (full) => {
      if (office) return full;
      return {
        supplier: {
          refundable: full?.supplier?.refundable ?? null,
          deadlineUtc: null, // hide supplier cutoff for public/b2c/b2b
        },
        platform: full?.platform ?? null,
        hoursUntilSupplierDeadline: null,
        // legacy flat mirrors (public)
        refundable:
          typeof full?.platform?.refundable === "boolean"
            ? full.platform.refundable
            : null,
        supplierDeadlineUtc: null,
        platformCutoffUtc: full?.platform?.cutoffUtc ?? null,
        safeToBook: full?.safeToBook ?? null,
        bufferDays: full?.bufferDays ?? bufferDays,
      };
    };

    const hotelsWithCxl = enriched.map((h) => {
      const offers = (h.offersPreview || h.offers || []).map((o) => {
        const rawDeadline = o?.cxlDeadline || null; // e.g., "07/Nov/2025"
        const supplierRefundable =
          typeof o?.refundable === "boolean" ? o.refundable : !!rawDeadline;

        const fullCxl = computeCancelSafety({
          supplierDeadline: rawDeadline,
          supplierRefundable,
          bufferDays,
        });

        // ստորագրված ապացույց՝ valuation fallback-ի համար
        const offerProof = signOfferProof({
          searchCode: o?.searchCode || null,
          amount: Number(o?.price?.amount || 0),
          currency: o?.price?.currency || null,
          arrivalDate,
          issuedAt: Date.now(),
        });

        return { ...o, cancellation: redactCancellation(fullCxl), offerProof };
      });

      const min = offers.length ? offers[0] : null;

      return { ...h, offersPreview: offers, minOffer: min };
    });

    // 5) role-based markup on NET minOffer (NO USD fallback)
    const roleMarkupPct = await getRoleMarkupPct(req);
    let hotels = hotelsWithCxl.map((h) => {
      const net = Number(h?.minOffer?.price?.amount || 0);
      const cur = h?.minOffer?.price?.currency || effectiveCurrency;
      if (!net || !cur) return { ...h, minPrice: null };
      const final = net * (1 + roleMarkupPct / 100);
      return { ...h, minPrice: { amount: Number(final.toFixed(2)), currency: cur } };
    });

    /* ----------------- ✨ ՆՈՐ՝ Stars/Price filter + sort ----------------- */
    const minStarsN = Number(minStars);
    const maxStarsN = Number(maxStars);
    const hasMinStars = Number.isFinite(minStarsN) && String(minStars).trim() !== "";
    const hasMaxStars = Number.isFinite(maxStarsN) && String(maxStars).trim() !== "";

    const priceMinN = Number(priceMin);
    const priceMaxN = Number(priceMax);
    const hasPriceMin = Number.isFinite(priceMinN) && String(priceMin).trim() !== "";
    const hasPriceMax = Number.isFinite(priceMaxN) && String(priceMax).trim() !== "";

    // filter by stars & retail minPrice
    hotels = hotels.filter((h) => {
      const stars = Number(h?.stars || 0);
      if (hasMinStars && stars < minStarsN) return false;
      if (hasMaxStars && stars > maxStarsN) return false;

      const amt = Number(h?.minPrice?.amount || 0);
      if (hasPriceMin && (!amt || amt < priceMinN)) return false;
      if (hasPriceMax && (!amt || amt > priceMaxN)) return false;

      return true;
    });

    // sort (default price_asc)
    const sortKey = String(sort || "price_asc").toLowerCase();
    const cmp = {
      price_asc:  (a, b) => (a?.minPrice?.amount ?? 1e15) - (b?.minPrice?.amount ?? 1e15),
      price_desc: (a, b) => (b?.minPrice?.amount ?? 0)    - (a?.minPrice?.amount ?? 0),
      stars_desc: (a, b) => (b?.stars ?? 0) - (a?.stars ?? 0),
      stars_asc:  (a, b) => (a?.stars ?? 0) - (b?.stars ?? 0),
      name_asc:   (a, b) => String(a?.name || "").localeCompare(String(b?.name || "")),
    };
    hotels.sort(cmp[sortKey] || cmp.price_asc);

    // 6) OPTIONAL: include slim hotel-info for top N
    const wantInfo = ["1", "true", "yes"].includes(String(includeInfo || "").toLowerCase());
    if (wantInfo && hotels.length) {
      const limit = Math.max(1, Number(infoLimit) || 3);
      const langCode = (infoLang || lang || "en").toString();
      const slice = hotels.slice(0, Math.min(limit, hotels.length));

      await Promise.all(
        slice.map(async (h) => {
          try {
            const slim = await getSlimHotelInfo(h._id, langCode);
            h.hotelInfo = {
              descriptionHtml: slim.descriptionHtml || "",
              facilitiesHtml: slim.facilitiesHtml || "",
              roomFacilitiesHtml: slim.roomFacilitiesHtml || "",
            };
            if (!h.location?.address && slim.address) {
              h.location = { ...(h.location || {}), address: slim.address };
            }
            if ((!h.name || h.name === "Hotel") && slim.name) h.name = slim.name;
            if ((!h.stars || h.stars === 0) && Number.isFinite(slim.category)) {
              h.stars = slim.category;
            }
            const have = new Set((h.images || []).map((i) => i.url));
            const add = (slim.pictures || []).filter((p) => p.url && !have.has(p.url));
            if (add.length) h.images = [...(h.images || []), ...add];
          } catch (e) {
            console.error("hotel-info enrichment failed for", h._id, e);
            h.hotelInfo = { descriptionHtml: "", facilitiesHtml: "", roomFacilitiesHtml: "" };
          }
        })
      );
    }

    // infer currency for meta if needed
    const inferredCurrency =
      hotels.find((h) => h?.minOffer?.price?.currency)?.minOffer?.price?.currency || null;

    // ✨ searchContext-ում պահենք նաև CSV-aware ինֆոն՝ debugging-ի համար
    const searchContext = {
      arrivalDate,
      nights: Number(nights),
      rooms: roomCount,
      adultsCSV: String(adults),
      childrenCSV: String(children),
      childrenAgesCSV: String(childrenAges),
      currencyUsed: effectiveCurrency || inferredCurrency || null,
    };

    const baseMeta = {
      provider: "goglobal",
      currencyUsed: searchContext.currencyUsed,
      total: hotels.length,
      hydration: {
        requestedCityId: String(cityId),
        matchedCodes: codes.length,
        matchedInDb: dbHotels.length,
      },
    };
    if (office) baseMeta.roleMarkupPct = roleMarkupPct;

    res.json({ hotels, searchContext, meta: baseMeta });
  } catch (e) {
    console.error("❌ goglobalAvailability error:", e);
    res.status(500).json({ message: "Availability failed", error: e.message });
  }
};

export const goglobalValuation = async (req, res) => {
  try {
    /* ---------- Debug role overrides for Swagger / tests ---------- */
    const debugRole = req.headers["x-debug-role"];
    if (debugRole) {
      req.user = req.user || {};
      req.user.role = debugRole;
      if (debugRole === "b2b_sales_partner" && req.headers["x-debug-markup"]) {
        req.user.markupPercentage = Number(req.headers["x-debug-markup"]);
      }
    }

    const isOfficeRole = (role) =>
      ["office_user", "admin", "finance"].includes(String(role || "").toLowerCase());

    /* ---------- Inputs ---------- */
    const hotelSearchCode = req.body?.hotelSearchCode || req.query?.hotelSearchCode;
    const arrivalDate = req.body?.arrivalDate || req.query?.arrivalDate;
    const originalAmountQ = req.body?.originalAmount ?? req.query?.originalAmount;
    const originalCurrencyQ = req.body?.originalCurrency ?? req.query?.originalCurrency;
    const offerProof =
      req.body?.offerProof || req.query?.offerProof || req.headers["x-offer-proof"];

    // explicit allow switch for office fallback (prevents silent misuse)
    const allowOfficeFallback =
      String(req.headers["x-allow-office-fallback"] || "").trim() === "1" ||
      String(req.query?.allowOfficeFallback || "").trim() === "1";

    if (!hotelSearchCode) {
      return res.status(400).json({ message: "hotelSearchCode is required" });
    }

    const role = (req.user?.role || "guest").toLowerCase();
    const office = isOfficeRole(role);

    /* ---------- OfferProof enforcement (public roles only, if enabled) ---------- */
    const REQUIRE_PROOF = /^true$/i.test(process.env.OFFER_PROOF_REQUIRED || "false");

    if (REQUIRE_PROOF && !office) {
      if (!offerProof) {
        return res.status(400).json({
          code: "PROOF_REQUIRED",
          message:
            "offerProof is required. Request valuation only for an offer returned by Availability.",
          hint:
            "Call Availability, take offers[i].offerProof and pass it as ?offerProof=... or X-Offer-Proof header.",
        });
      }
    }

    /* ---------- 1) Call supplier valuation (no currency/price forced) ---------- */
    const raw = await bookingValuation({ hotelSearchCode, arrivalDate });

    /* ---------- 2) Parse supplier response (price/cxl/remarks) ---------- */
    const v = normalizeValuation(raw /* no fallback currency here */);

    /* ---------- 3) Decide base price & its source ---------- */
    let baseAmount = Number(v?.price?.amount || 0);
    let baseCurrency = v?.price?.currency || null;
    let priceSource = "supplier"; // 'supplier' | 'offerProof' | 'officeFallback'

    // Prefer supplier fresh price
    if (!baseAmount || !baseCurrency) {
      // Try verified offerProof
      if (offerProof) {
        const vr = verifyOfferProof(offerProof);
        if (!vr.ok) {
          if (!office) {
            return res.status(401).json({
              code: "INVALID_OFFER_PROOF",
              message: "Offer proof is invalid or expired.",
            });
          }
          // office can continue to fallback if allowed below
        } else {
          const p = vr.payload || {};
          // strict binding to searchCode + (optional) arrivalDate
          if (!p.searchCode || String(p.searchCode) !== String(hotelSearchCode)) {
            return res.status(401).json({
              code: "INVALID_OFFER_PROOF",
              message: "Offer proof hotelSearchCode mismatch.",
            });
          }
          if (arrivalDate && p.arrivalDate && String(arrivalDate) !== String(p.arrivalDate)) {
            return res.status(401).json({
              code: "INVALID_OFFER_PROOF",
              message: "Offer proof arrivalDate mismatch.",
            });
          }
          if (!p.amount || !p.currency) {
            return res.status(401).json({
              code: "INVALID_OFFER_PROOF",
              message: "Offer proof missing amount/currency.",
            });
          }
          baseAmount = Number(p.amount);
          baseCurrency = String(p.currency).toUpperCase();
          priceSource = "offerProof";
        }
      }

      // Office-only legacy fallback, now gated by explicit allow flag
      if ((!baseAmount || !baseCurrency) && office) {
        const oa = Number(originalAmountQ || 0);
        const oc = (originalCurrencyQ || "").toString().toUpperCase();
        if (oa > 0 && /^[A-Z]{3}$/.test(oc)) {
          if (!allowOfficeFallback) {
            return res.status(424).json({
              code: "NO_PRICE",
              message: "Supplier valuation unavailable and no offerProof provided.",
              hint:
                "Refresh availability and include offerProof. To override as office, pass header X-Allow-Office-Fallback: 1 (or ?allowOfficeFallback=1) together with originalAmount/originalCurrency.",
            });
          }
          baseAmount = oa;
          baseCurrency = oc;
          priceSource = "officeFallback";
        }
      }
    }

    // If still no price → fail
    if (!baseAmount || !baseCurrency) {
      return res.status(424).json({
        message: "Supplier valuation unavailable",
        code: "NO_PRICE",
        hint: REQUIRE_PROOF
          ? "Please refresh availability (and send offerProof) and retry."
          : "Please refresh availability (or send offerProof) and retry.",
        ...(req.query?.debugXml === "1" && raw?.__rawXml
          ? { debugXmlSnippet: String(raw.__rawXml).slice(0, 900) }
          : {}),
      });
    }

    /* ---------- 4) Role-based markup ---------- */
    const roleMarkupPct = await getRoleMarkupPct(req);
    const markupAmount = Number(((baseAmount * roleMarkupPct) / 100).toFixed(2));
    const totalAmount = Number((baseAmount + markupAmount).toFixed(2));

    /* ---------- 5) AMD mirrors (optional) ---------- */
    const settingsDoc = await GlobalSettings.findOne({}).lean();
    const rates = settingsDoc?.exchangeRates || settingsDoc?.rates || null;
    const getRate = (code) => {
      if (!rates) return null;
      const r = rates[String(code).toUpperCase()];
      return Number.isFinite(Number(r)) ? Number(r) : null;
    };
    const toAMD = (amt, from) => {
      const r = getRate(from);
      return r ? Number((amt * r).toFixed(2)) : null;
    };
    const baseAmd = toAMD(baseAmount, baseCurrency);
    const markupAmd = toAMD(markupAmount, baseCurrency);
    const totalAmd = toAMD(totalAmount, baseCurrency);

    /* ---------- 6) Cancellation views ---------- */
    const safetyBufferDays = Number(process.env.BOOKING_SAFETY_BUFFER_DAYS || 4);
    const supplierDeadline = v.cancellationDeadline || null;
    const supplierRefundable = supplierDeadline ? true : v?.refundable ?? null;

    const cancellationFull = computeCancelSafety({
      supplierDeadline,
      supplierRefundable,
      bufferDays: safetyBufferDays,
    });

    // Redact for non-office roles
    const cancellationPublic = (() => {
      if (office) return cancellationFull;
      return {
        supplier: {
          refundable: cancellationFull?.supplier?.refundable ?? null,
          deadlineUtc: null,
        },
        platform: cancellationFull?.platform ?? null,
        hoursUntilSupplierDeadline: null,
        refundable:
          typeof cancellationFull?.platform?.refundable === "boolean"
            ? cancellationFull.platform.refundable
            : null,
        supplierDeadlineUtc: null,
        platformCutoffUtc: cancellationFull?.platform?.cutoffUtc ?? null,
        safeToBook: cancellationFull?.safeToBook ?? null,
        bufferDays: cancellationFull?.bufferDays ?? safetyBufferDays,
      };
    })();

    /* ---------- 7) Remarks (annotated) ---------- */
    const supplierRemarksHtml = v.remarks || "";
    const platformCutoffIso = cancellationFull?.platform?.cutoffUtc || null;
    const supplierDeadlineIso = cancellationFull?.supplier?.deadlineUtc || null;

    const platformNoteHtml = platformCutoffIso
      ? `<p><strong>Platform policy:</strong> Free cancellation until <u>${platformCutoffIso}</u>.</p>`
      : `<p><strong>Platform policy:</strong> Non-refundable.</p>`;

    const officeNoteHtml =
      office && supplierDeadlineIso
        ? `<p><em>(Office)</em> Supplier cutoff: <u>${supplierDeadlineIso}</u>.</p>`
        : "";

    const remarksAnnotatedHtml = `${platformNoteHtml}${officeNoteHtml}${supplierRemarksHtml}`;

    /* ---------- 8) Response ---------- */
    const valuationPayload = {
      price: { amount: totalAmount, currency: baseCurrency },
      cancellation: office ? cancellationFull : cancellationPublic,
      remarks: supplierRemarksHtml,
      remarksAnnotatedHtml,
    };

    // Expose financials to office
    if (office) {
      valuationPayload.supplierPrice = { amount: baseAmount, currency: baseCurrency };
      valuationPayload.breakdown = {
        supplierBase: { amount: baseAmount, currency: baseCurrency },
        markup: { amount: markupAmount, currency: baseCurrency },
        total: { amount: totalAmount, currency: baseCurrency },
        supplierBaseAmd: baseAmd,
        markupAmd,
        totalAmd,
        exchange: {
          base: "AMD",
          usedRateFor: baseCurrency,
          rate: getRate(baseCurrency),
          lastUpdatedAt: settingsDoc?.ratesUpdatedAt || settingsDoc?.updatedAt || null,
        },
        taxesAndFees: {
          payAtHotelNote: (() => {
            const s = String(supplierRemarksHtml || "");
            if (/city\s*tax/i.test(s) || /payable\s+at\s+hotel/i.test(s)) {
              return "City/Local tax payable at hotel (see remarks).";
            }
            return null;
          })(),
        },
      };
    }

    const meta = {
      provider: "goglobal",
      safety: { bufferDays: safetyBufferDays },
      roleMarkupPct,
      priceSource, // 'supplier' | 'offerProof' | 'officeFallback'
    };
    if (priceSource === "officeFallback") {
      meta.warning =
        "Office fallback used: price was not verified by supplier or offerProof in this request.";
    }

    return res.json({ valuation: valuationPayload, meta });
  } catch (e) {
    if (/Supplier Error\s+315/i.test(String(e.message))) {
      return res.status(409).json({
        message: "Supplier session not found",
        hint: "Please refresh availability and retry valuation within the same session.",
        code: 315,
      });
    }
    console.error("❌ goglobalValuation error:", e);
    return res.status(500).json({ message: "Valuation failed", error: e.message });
  }
};

// GET /api/v1/suppliers/goglobal/hotel-info
export const goglobalHotelInfo = async (req, res) => {
  try {
    const hotelId = req.query?.hotelId || req.params?.hotelId;
    const lang = req.query?.lang || "en";
    if (!hotelId)
      return res.status(400).json({ message: "hotelId is required" });

    // helpers
    const getText = (v) => {
      if (v == null) return "";
      if (typeof v === "string") return v;
      if (typeof v === "number") return String(v);
      if (Array.isArray(v)) return v.map(getText).join(" ");
      if (typeof v === "object")
        return getText(v._ ?? v["#text"] ?? v.text ?? v.url ?? v.Url ?? "");
      return String(v);
    };
    const stripCdata = (s) =>
      String(s || "")
        .trim()
        .replace(/<!\[CDATA\[|\]\]>/g, "");
    const toList = (html) =>
      stripCdata(html)
        .replace(/<br\s*\/?>/gi, "\n")
        .replace(/<\/?[^>]+>/g, "")
        .split(/\n+/)
        .map((x) => x.trim())
        .filter(Boolean);

    const payload = await hotelInfo({
      hotelId: String(hotelId),
      language: String(lang),
      responseFormat: "JSON",
    });

    // ---- JSON paths (several shapes)
    const Main =
      payload?.Main ||
      payload?.Root?.Main ||
      payload?.Data?.Main ||
      payload?.Hotel ||
      null;

    if (Main) {
      const core =
        Main.Hotel || Main.HotelInfo || Main.HotelInformation || Main;

      const name = stripCdata(getText(core.HotelName || core.Name));
      const address = stripCdata(
        getText(core.Address || core.Address1 || core.AddressLine1)
      );
      const cityId = stripCdata(
        getText(core.CityCode || core.CityId || Main.CityCode)
      );
      const category = Number(getText(core.Category || core.Stars)) || 0;

      const descriptionHtml = stripCdata(
        getText(core.Description || Main.Description)
      );
      const facilitiesHtml = stripCdata(
        getText(core.HotelFacilities || Main.HotelFacilities)
      );
      const roomFacilitiesHtml = stripCdata(
        getText(core.RoomFacilities || Main.RoomFacilities)
      );

      const picsNode = core.Pictures || Main.Pictures || {};
      const rawPics = Array.isArray(picsNode?.Picture)
        ? picsNode.Picture
        : picsNode?.Picture
        ? [picsNode.Picture]
        : [];

      const pictures = rawPics
        .map((p, i) => {
          const url = stripCdata(getText(p))
            .replace(/<\/?[^>]+>/g, "")
            .trim();
          const isMain =
            /primary|main/i.test(String(p?.$?.Description || "")) || i === 0;
          return url ? { url, isMain } : null;
        })
        .filter(Boolean);

      return res.json({
        hotel: {
          hotelId: String(hotelId),
          name,
          address,
          cityId,
          category,
          descriptionHtml,
          facilitiesHtml,
          roomFacilitiesHtml,
          facilities: toList(facilitiesHtml),
          roomFacilities: toList(roomFacilitiesHtml),
          checkinTime:
            (descriptionHtml.match(/Checkin Time:\s*([0-9:apm\s]+)/i) ||
              [])[1] || null,
          checkoutTime:
            (descriptionHtml.match(
              /Checkout (?:From|Time):\s*([0-9:apm\s]+)/i
            ) || [])[1] || null,
          pictures,
        },
        meta: { provider: "goglobal" },
      });
    }

    // ---- XML fallback
    const xml = payload?.__rawXml || "";
    if (xml) {
      const unesc = (s) =>
        String(s || "")
          .replace(/&lt;/g, "<")
          .replace(/&gt;/g, ">")
          .replace(/&amp;/g, "&");
      const pick = (tag) => {
        const m = xml.match(new RegExp(`<${tag}>([\\s\\S]*?)<\\/${tag}>`, "i"));
        return m ? m[1].trim() : "";
      };

      const name = stripCdata(unesc(pick("HotelName")));
      const address = stripCdata(unesc(pick("Address")));
      const cityId = stripCdata(unesc(pick("CityCode")));
      const category = Number(stripCdata(unesc(pick("Category")))) || 0;

      const descriptionHtml = stripCdata(unesc(pick("Description")));
      const facilitiesHtml = stripCdata(unesc(pick("HotelFacilities")));
      const roomFacilitiesHtml = stripCdata(unesc(pick("RoomFacilities")));

      const picsBlock =
        xml.match(/<Pictures>([\s\S]*?)<\/Pictures>/i)?.[1] ?? "";
      const urls = Array.from(
        picsBlock.matchAll(/<!\[CDATA\[([^\]]+)\]\]>/g)
      ).map((m) => m[1].trim());
      const pictures = urls.map((u, i) => ({ url: u, isMain: i === 0 }));

      return res.json({
        hotel: {
          hotelId: String(hotelId),
          name,
          address,
          cityId,
          category,
          descriptionHtml,
          facilitiesHtml,
          roomFacilitiesHtml,
          facilities: toList(facilitiesHtml),
          roomFacilities: toList(roomFacilitiesHtml),
          checkinTime:
            (descriptionHtml.match(/Checkin Time:\s*([0-9:apm\s]+)/i) ||
              [])[1] || null,
          checkoutTime:
            (descriptionHtml.match(
              /Checkout (?:From|Time):\s*([0-9:apm\s]+)/i
            ) || [])[1] || null,
          pictures,
        },
        meta: { provider: "goglobal" },
      });
    }

    return res.status(502).json({
      message: "Hotel info unavailable",
      error: "Supplier returned empty payload",
    });
  } catch (e) {
    console.error("❌ goglobalHotelInfo error:", e);
    res.status(500).json({ message: "Hotel info failed", error: e.message });
  }
};

export const goglobalHotelAvailability = async (req, res) => {
  try {
    // ---- Debug role override (Swagger / tests) ----
    const debugRole = req.headers["x-debug-role"];
    if (debugRole) {
      req.user = req.user || {};
      req.user.role = debugRole;
      if (debugRole === "b2b_sales_partner" && req.headers["x-debug-markup"]) {
        req.user.markupPercentage = Number(req.headers["x-debug-markup"]);
      }
    }
    const isOfficeRole = (role) =>
      ["office_user", "admin", "finance"].includes(String(role || "").toLowerCase());
    const office = isOfficeRole(req.user?.role);

    // ---- Inputs ----
    const {
      cityId,
      hotelId,
      arrivalDate,
      nights,
      rooms = "1",
      adults = "2",
      children = "0",
      childrenAges = "",
      filterBasis = "",
      maximumWaitTime,
      maxOffers,
      nationality,
    } = req.query;

    if (!cityId || !hotelId || !arrivalDate || !nights) {
      return res
        .status(400)
        .json({ message: "cityId, hotelId, arrivalDate, nights are required" });
    }

    // ---- Pax build ----
    const roomCount = Math.max(1, Number(rooms) || 1);
    const A = String(adults).split(",").map((n) => Number(n || 0));
    const C = String(children).split(",").map((n) => Number(n || 0));
    const ageGroups = childrenAges
      ? childrenAges.split("|").map((g) => g.split(",").map((x) => Number(x || 0)))
      : [];

    const pax = Array.from({ length: roomCount }).map((_, i) => ({
      adults: A[i] ?? A[0] ?? 2,
      childrenAges: (ageGroups[i] || []).slice(0, C[i] ?? C[0] ?? 0),
      roomCount: 1,
    }));

    // ---- Supplier call (single hotel) ----
    const raw = await hotelSearchAvailability({
      cityId: String(cityId),
      arrivalDate,
      nights: Number(nights),
      pax,
      nationality,
      responseFormat: "JSON",
      hotelIds: [String(hotelId)],
      filterBasis: String(filterBasis)
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean),
      maxOffers: Number(maxOffers) || undefined,
      maximumWaitTime:
        Number(maximumWaitTime) || Number(process.env.GG_MAX_WAIT_SECONDS || 15),
    });

    // ---- Normalize ----
    const normalized = normalizeAvailability(raw, Number(maxOffers) || 8);
    const h =
      normalized.find((x) => String(x._id) === String(hotelId)) || normalized[0];

    if (!h) {
      return res.json({
        hotel: {
          hotelId: String(hotelId),
          name: null,
          category: null,
          address: null,
          city: null,
          country: null,
          image: null,
          offers: [],
          minRetail: null,
        },
        meta: { provider: "goglobal", found: false },
      });
    }

    // ---- Cancellation redact helper ----
    const bufferDays = Number(process.env.BOOKING_SAFETY_BUFFER_DAYS || 4) || 4;
    const redactCancellation = (full) => {
      if (office) return full;
      return {
        supplier: {
          refundable: full?.supplier?.refundable ?? null,
          deadlineUtc: null,
        },
        platform: full?.platform ?? null,
        hoursUntilSupplierDeadline: null,
        // legacy mirrors (public view)
        refundable:
          typeof full?.platform?.refundable === "boolean"
            ? full.platform.refundable
            : null,
        supplierDeadlineUtc: null,
        platformCutoffUtc: full?.platform?.cutoffUtc ?? null,
        safeToBook: full?.safeToBook ?? null,
        bufferDays: full?.bufferDays ?? bufferDays,
      };
    };

    // ---- helpers for room names (multi-room aware) ----
    const trimStr = (s) => String(s || "").replace(/\s+/g, " ").trim();
    const deriveRoomNames = (o) => {
      // 1) already normalized from multi-hotel flow
      if (Array.isArray(o?.roomNames) && o.roomNames.length) {
        return o.roomNames.map(trimStr).filter(Boolean);
      }
      // 2) fallback: if roomName is "A + B + C", split on " + "
      if (typeof o?.roomName === "string" && /\s\+\s/.test(o.roomName)) {
        return o.roomName.split(/\s\+\s/).map(trimStr).filter(Boolean);
      }
      // 3) last resort: single name only
      if (typeof o?.roomName === "string" && o.roomName.trim()) {
        return [trimStr(o.roomName)];
      }
      return [];
    };

    // ---- Role-based retail preview (and optional net redaction) ----
    const roleMarkupPct = await getRoleMarkupPct(req);
    const REDACT_NET_FOR_PUBLIC = /^(true|1|yes|on)$/i.test(
      String(process.env.REDACT_NET_FOR_PUBLIC ?? "true")
    );
    const shouldRedactNet = !office && REDACT_NET_FOR_PUBLIC;
    const round2 = (n) => Math.round(Number(n || 0) * 100) / 100;

    const offers = (h.offersPreview || h.offers || []).map((o) => {
      const rawDeadline = o?.cxlDeadline || null;
      const supplierRefundable =
        typeof o?.refundable === "boolean" ? o.refundable : !!rawDeadline;

      const fullCxl = computeCancelSafety({
        supplierDeadline: rawDeadline,
        supplierRefundable,
        bufferDays,
      });

      // build/verify multi-room fields
      const roomNames = deriveRoomNames(o);
      const roomsCount = roomNames.length || Number(rooms) || 1;
      const aggregateName =
        roomNames.length > 1
          ? roomNames.join(" + ")
          : (o?.roomName || roomNames[0] || null);

      const offerProof = signOfferProof({
        searchCode: o?.searchCode || null,
        amount: Number(o?.price?.amount || 0),      // supplier NET
        currency: o?.price?.currency || null,
        arrivalDate,
        issuedAt: Date.now(),
      });

      // ---- Compute retail preview on top of NET ----
      const netAmt = Number(o?.price?.amount || 0);
      const cur = o?.price?.currency || null;
      const retailAmt = cur && netAmt > 0 ? round2(netAmt * (1 + roleMarkupPct / 100)) : null;

      const base = {
        ...o,
        // normalized multi-room view
        roomName: aggregateName,
        roomNames,
        roomsCount,
        // cancellation & pricing
        cancellation: redactCancellation(fullCxl),
        offerProof,
        retail: retailAmt && cur ? { amount: retailAmt, currency: cur } : null,
      };

      // breakdown only for office roles
      if (office && retailAmt && cur) {
        base.retailBreakdown = {
          net: { amount: netAmt, currency: cur },
          markupPct: roleMarkupPct,
          markupAmount: round2(retailAmt - netAmt),
        };
      }

      // redact NET for public if enabled
      if (shouldRedactNet) base.price = null;

      return base;
    });

    // keep order by NET asc (monotonic to retail when pct is uniform)
    offers.sort((a, b) => {
      const ax = a?.retail?.amount ?? a?.price?.amount ?? 1e9;
      const bx = b?.retail?.amount ?? b?.price?.amount ?? 1e9;
      return ax - bx;
    });

    // ---- city/country resolve (fallback map) ----
    const cid = String(h?.externalSource?.cityId || cityId || "").trim() || null;
    const cityRec = cid ? cityFromId(cid) : null;
    const cityName = h?.location?.city || cityRec?.CityName || null;
    const countryName = h?.location?.country || cityRec?.Country || null;

    // ---- primary image ----
    const primaryImage =
      (Array.isArray(h?.images) &&
        h.images.find((i) => i && i.isMain && i.url)?.url) ||
      (Array.isArray(h?.images) && h.images[0]?.url) ||
      h?.thumbnail ||
      null;

    // ---- minRetail helper (for convenience in FE) ----
    const minRetail = (() => {
      const first = offers.find((o) => o?.retail && o.retail.amount > 0);
      return first ? first.retail : null;
    })();

    // ---- response ----
    return res.json({
      hotel: {
        hotelId: String(hotelId),
        name: h?.name || null,
        category: Number(h?.stars || 0) || null,
        address: h?.location?.address || null,
        city: cityName,
        country: countryName,
        image: primaryImage,
        offers,
        minRetail, // convenience
      },
      meta: {
        provider: "goglobal",
        found: true,
        ...(office ? { roleMarkupPct } : {}), // don’t leak to public
      },
    });
  } catch (e) {
    console.error("❌ goglobalHotelAvailability error:", e);
    return res
      .status(500)
      .json({ message: "Hotel availability failed", error: e.message });
  }
};
