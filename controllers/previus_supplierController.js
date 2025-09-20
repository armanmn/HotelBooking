// controllers/supplierController.js
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

import GlobalSettings from "../models/GlobalSettings.js";
import { mapCityForSupplier } from "../services/cityResolver.js";
import Hotel from "../models/Hotel.js";
import Offer from "../models/Offer.js";
import {
  hotelSearchAvailability,
  bookingValuation,
  hotelInfo,
} from "../services/goglobalClient.js";
import { signOfferProof } from "../utils/offerProof.js";
import { verifyOfferProof } from "../utils/offerProof.js";
import { resolveEffectiveCurrency } from "../utils/currency.js"; // ✅ NEW

/* ----------------------------- Utils / helpers ----------------------------- */

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const SAFETY_BUFFER_DAYS = Number(process.env.BOOKING_SAFETY_BUFFER_DAYS || 4);
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

  // Customer-facing refundable = միայն եթե supplier refundable է ԵՎ platform cutoff-ը դեռ չի անցել
  const platformRefundable = Boolean(
    supplierRefundable === true && cutoffMs && now < cutoffMs
  );

  return {
    // Nested views
    supplier: {
      refundable: supplierRefundable === true, // ինչ supplier-ն է ասում
      deadlineUtc: supplierDeadlineUtc,
    },
    platform: {
      refundable: platformRefundable, // ինչ ցույց ենք տալիս ՀԱՃԱԽՈՐԴԻՆ (+buffer policy)
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

    // Legacy flat fields (don’t break old UI)
    refundable: supplierRefundable === true, // supplier angle
    supplierDeadlineUtc,
    platformCutoffUtc,
    safeToBook: platformRefundable, // === platform.refundable
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

// 👇 helper՝ Rooms -> roomName
function pickRoomName(o) {
  if (Array.isArray(o?.Rooms) && o.Rooms.length) {
    return String(o.Rooms[0] ?? "").trim() || null;
  }
  if (typeof o?.Rooms === "string" && o.Rooms.trim()) {
    return o.Rooms.trim();
  }
  if (o?.RoomName && String(o.RoomName).trim())
    return String(o.RoomName).trim();
  if (o?.roomName && String(o.roomName).trim())
    return String(o.roomName).trim();
  return null;
}

function mapOffer(o) {
  const amount =
    toNum(o?.TotalPrice) ||
    toNum(o?.Price?.Total) ||
    toNum(o?.Price) ||
    toNum(o?.amount);
  const currency = o?.Currency || o?.Price?.Currency || o?.currency;
  if (!amount || !currency) return null;

  // supplier flags
  const nonRefFlag = o?.NonRef === true;
  const refundableFlag = o?.Refundable; // true|false|undefined
  const supplierDeadline =
    o?.CxlDeadLine || o?.CxlDeadline || o?.CancelDeadline || null;

  // Լոգիկա՝ մեղմ, բայց կանխատեսելի
  let supplierRefundable = null;
  if (nonRefFlag === true) supplierRefundable = false;
  else if (refundableFlag === false) supplierRefundable = false;
  else if (refundableFlag === true) supplierRefundable = true;
  else if (supplierDeadline)
    supplierRefundable = true; // deadline-ը սովորաբար նշանակում է refundable՝ մինչև այդ պահը
  else supplierRefundable = null;

  const safety = computeCancelSafety({
    supplierDeadline,
    supplierRefundable,
  });

  return {
    price: { amount, currency }, // NET
    board: mapBoard(o?.RoomBasis),
    // legacy:
    refundable: safety.refundable,
    cxlDeadline: supplierDeadline,
    // նոր, «արտահայտիչ» բլոկը՝ երկու տեսանկյունով
    cancellation: safety, // { supplier:{...}, platform:{...}, hoursUntilSupplierDeadline, ... }
    searchCode: o?.HotelSearchCode || o?.SearchCode || o?.rateToken || null,
    category: toNum(o?.Category, 0),
    roomName: pickRoomName(o),
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

    const remarks = v?.Remarks || v?.Notes || null;

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
    // a) attribute case: <Rates currency="EUR">123.45</Rates>
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
    // b) text case: <Rates>145.5 EUR</Rates>
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
  const remarksText = remarksHtml
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/?[^>]+>/g, "")
    .trim();

  // return ...
  return {
    price: maybePrice,
    cancellationDeadline: cxl,
    remarks: remarksHtml,
    remarksText, // optional՝ եթե պետք ա տեքստային տարբերակ
  };
}

/* --------- Slim hotel-info helper for availability enrichment --------- */
function _coerceArr(x) {
  return Array.isArray(x) ? x : x ? [x] : [];
}
function _unescapeEntities(s) {
  return String(s || "")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&");
}
function _pickTag(xml, tag) {
  const m = String(xml).match(
    new RegExp(`<${tag}>([\\s\\S]*?)<\\/${tag}>`, "i")
  );
  return m ? m[1].trim() : "";
}

async function getSlimHotelInfo(hotelId, lang = "en") {
  const payload = await hotelInfo({
    hotelId,
    language: lang,
    responseFormat: "JSON",
  });

  // JSON case
  const Main = payload?.Main || payload?.Root?.Main;
  if (Main) {
    const descriptionHtml = Main.Description || "";
    const facilitiesHtml = Main.HotelFacilities || "";
    const roomFacilitiesHtml = Main.RoomFacilities || "";

    const picNodes = Main?.Pictures?.Picture;
    const pics = _coerceArr(picNodes)
      .map((p, i) => {
        const raw = (p?._ || p["#text"] || p.text || p.url || "").toString();
        const url = raw.replace(/<\/?[^>]+>/g, "").trim();
        const isMain =
          /primary|main/i.test(String(p?.$?.Description || "")) || i === 0;
        return url ? { url, isMain } : null;
      })
      .filter(Boolean);

    return {
      descriptionHtml,
      facilitiesHtml,
      roomFacilitiesHtml,
      pictures: pics,
    };
  }

  // XML fallback
  const xml = payload?.__rawXml || "";
  if (!xml)
    return {
      descriptionHtml: "",
      facilitiesHtml: "",
      roomFacilitiesHtml: "",
      pictures: [],
    };

  const descriptionHtml = _unescapeEntities(_pickTag(xml, "Description"));
  const facilitiesHtml = _unescapeEntities(_pickTag(xml, "HotelFacilities"));
  const roomFacilitiesHtml = _unescapeEntities(_pickTag(xml, "RoomFacilities"));

  const picsBlock = xml.match(/<Pictures>([\s\S]*?)<\/Pictures>/i)?.[1] ?? "";
  const urls = Array.from(picsBlock.matchAll(/<!\[CDATA\[([^\]]+)\]\]>/g)).map(
    (m) => m[1].trim()
  );
  const pictures = urls.map((u, i) => ({ url: u, isMain: i === 0 }));

  return { descriptionHtml, facilitiesHtml, roomFacilitiesHtml, pictures };
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
      ["office_user", "admin", "finance"].includes(
        String(role || "").toLowerCase()
      );

    const {
      cityId,
      arrivalDate,
      nights,
      currency, // optional: meta only
      nationality,
      rooms = "1",
      adults = "2",
      children = "0",
      childrenAges = "",
      maxHotels,
      maxOffers,
      maximumWaitTime,

      // enrichment flags
      includeInfo,
      infoLimit,
      infoLang,
      lang,
    } = req.query;

    if (!cityId || !arrivalDate || !nights) {
      return res
        .status(400)
        .json({ message: "cityId, arrivalDate, nights are required" });
    }

    // ✅ SOFT currency resolve (no 400). SOAP-ին չենք ուղարկում currency.
    const settingsDoc = await GlobalSettings.findOne({}).lean();
    const defaultCurrency = (
      settingsDoc?.defaultCurrency ||
      process.env.DEFAULT_CURRENCY ||
      ""
    )
      .toString()
      .toUpperCase();
    const softResolveCurrency = (q, u, d) => {
      const c = (q || u || d || "").toString().toUpperCase();
      return /^[A-Z]{3}$/.test(c) ? c : null;
    };
    const effectiveCurrency = softResolveCurrency(
      currency,
      req.user?.preferredCurrency,
      defaultCurrency
    ); // կարող է լինել null — OK

    const roomCount = Math.max(1, Number(rooms) || 1);
    const ad = Number(adults) || 2;
    const ch = Number(children) || 0;
    const ages = (childrenAges || "")
      .split(",")
      .map((x) => Number(x.trim()))
      .filter((x) => Number.isFinite(x));

    const pax = Array.from({ length: roomCount }).map(() => ({
      adults: ad,
      childrenAges: ages.slice(0, ch),
      roomCount: 1,
    }));

    const raw = await hotelSearchAvailability({
      cityId: String(cityId),
      arrivalDate,
      nights: Number(nights),
      pax,
      // currency: effectiveCurrency, // ⛔ չենք ուղարկում supplier-ին
      nationality,
      maxHotels: Number(maxHotels) || Number(process.env.GG_MAX_HOTELS || 150),
      maxOffers: Number(maxOffers) || Number(process.env.GG_MAX_OFFERS || 5),
      maximumWaitTime:
        Number(maximumWaitTime) ||
        Number(process.env.GG_MAX_WAIT_SECONDS || 15),
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

    const dbMap = new Map(
      dbHotels.map((x) => [String(x.externalSource.providerHotelId), x])
    );

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
          city:
            h.location?.city || db?.location?.city || cityRec?.CityName || null,
          country:
            h.location?.country ||
            db?.location?.country ||
            cityRec?.Country ||
            null,
          address: h.location?.address || db?.location?.address || null,
          lat:
            h.location?.lat ??
            db?.location?.coordinates?.lat ??
            db?.location?.lat ??
            null,
          lng:
            h.location?.lng ??
            db?.location?.coordinates?.lng ??
            db?.location?.lng ??
            null,
        },
        externalSource: {
          ...h.externalSource,
          cityId: cid,
        },
      };
    });

    // 4) Add cancellation (supplier vs platform) and redact for non-office roles
    const bufferDays = Number(process.env.BOOKING_SAFETY_BUFFER_DAYS || 4) || 4;
    const office = isOfficeRole(req.user?.role);

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
        let supplierRefundable;
        if (typeof o?.refundable === "boolean")
          supplierRefundable = o.refundable;
        else supplierRefundable = !!rawDeadline;

        const fullCxl = computeCancelSafety({
          supplierDeadline: rawDeadline,
          supplierRefundable,
          bufferDays,
        });

        // ✅ ստորագրված ապացույց՝ valuation fallback-ի համար
        const offerProof = signOfferProof({
          searchCode: o?.searchCode || null,
          amount: Number(o?.price?.amount || 0),
          currency: o?.price?.currency || null,
          arrivalDate, // այս availability call-ի query-ից
          issuedAt: Date.now(), // now
        });

        return {
          ...o,
          cancellation: redactCancellation(fullCxl),
          offerProof,
        };
      });

      const min = offers.length ? offers[0] : null;

      return {
        ...h,
        offersPreview: offers,
        minOffer: min,
      };
    });

    // 5) role-based markup on NET minOffer (NO USD fallback)
    const roleMarkupPct = await getRoleMarkupPct(req);
    const hotels = hotelsWithCxl.map((h) => {
      const net = Number(h?.minOffer?.price?.amount || 0);
      const cur = h?.minOffer?.price?.currency || effectiveCurrency; // եթե effectiveCurrency=null, օգտվում ենք supplier-ի արժույթից

      if (!net || !cur) {
        return { ...h, minPrice: null };
      }

      const final = net * (1 + roleMarkupPct / 100);
      return {
        ...h,
        minPrice: { amount: Number(final.toFixed(2)), currency: cur },
      };
    });

    // 6) OPTIONAL: include slim hotel-info for top N hotels
    const wantInfo = ["1", "true", "yes"].includes(
      String(includeInfo || "").toLowerCase()
    );
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

            const have = new Set((h.images || []).map((i) => i.url));
            const add = (slim.pictures || []).filter(
              (p) => p.url && !have.has(p.url)
            );
            if (add.length) h.images = [...(h.images || []), ...add];
          } catch (e) {
            console.error("hotel-info enrichment failed for", h._id, e);
            h.hotelInfo = {
              descriptionHtml: "",
              facilitiesHtml: "",
              roomFacilitiesHtml: "",
            };
          }
        })
      );
    }

    // infer a currency for meta if we didn't resolve one
    const inferredCurrency =
      hotels.find((h) => h?.minOffer?.price?.currency)?.minOffer?.price
        ?.currency || null;

    const searchContext = {
      arrivalDate,
      nights: Number(nights),
      rooms: roomCount,
      adults: ad,
      children: ch,
      childrenAges: ages,
      currencyUsed: effectiveCurrency || inferredCurrency || null, // meta only
    };

    res.json({
      hotels,
      searchContext,
      meta: {
        provider: "goglobal",
        currencyUsed: effectiveCurrency || inferredCurrency || null,
        total: hotels.length,
        roleMarkupPct,
        hydration: {
          requestedCityId: String(cityId),
          matchedCodes: codes.length,
          matchedInDb: dbHotels.length,
        },
      },
    });
  } catch (e) {
    console.error("❌ goglobalAvailability error:", e);
    res.status(500).json({ message: "Availability failed", error: e.message });
  }
};

// POST/GET /api/v1/suppliers/goglobal/valuation
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

    /* ---------- Helpers ---------- */
    const isOfficeRole = (role) =>
      ["office_user", "admin", "finance"].includes(
        String(role || "").toLowerCase()
      );

    /* ---------- Inputs ---------- */
    const hotelSearchCode =
      req.body?.hotelSearchCode || req.query?.hotelSearchCode;
    const arrivalDate = req.body?.arrivalDate || req.query?.arrivalDate;
    const originalAmountQ =
      req.body?.originalAmount ?? req.query?.originalAmount;
    const originalCurrencyQ =
      req.body?.originalCurrency ?? req.query?.originalCurrency;
    const offerProof =
      req.body?.offerProof ||
      req.query?.offerProof ||
      req.headers["x-offer-proof"];

    if (!hotelSearchCode) {
      return res.status(400).json({ message: "hotelSearchCode is required" });
    }

    /* ---------- 1) Call supplier valuation (no currency/price forced) ---------- */
    const raw = await bookingValuation({ hotelSearchCode, arrivalDate });

    /* ---------- 2) Parse supplier response (price/cxl/remarks) ---------- */
    const v = normalizeValuation(raw /* no fallback currency here */);

    /* ---------- 3) Decide supplier base price ---------- */
    const role = req.user?.role || "guest";
    const office = isOfficeRole(role);

    let supplierAmount = Number(v?.price?.amount || 0);
    let supplierCurrency = v?.price?.currency || null;

    if (!supplierAmount || !supplierCurrency) {
      // Try offerProof first (public-safe fallback)
      if (offerProof) {
        const vr = verifyOfferProof(offerProof);
        if (vr.ok) {
          const p = vr.payload || {};
          if (
            arrivalDate &&
            p.arrivalDate &&
            String(arrivalDate) !== String(p.arrivalDate)
          ) {
            return res.status(422).json({
              message: "Offer proof arrivalDate mismatch",
              code: "PROOF_MISMATCH",
            });
          }
          if (
            !p.searchCode ||
            String(p.searchCode) !== String(hotelSearchCode)
          ) {
            return res.status(422).json({
              message: "Offer proof hotelSearchCode mismatch",
              code: "PROOF_MISMATCH",
            });
          }
          if (!p.amount || !p.currency) {
            return res.status(422).json({
              message: "Offer proof missing amount/currency",
              code: "PROOF_INCOMPLETE",
            });
          }
          supplierAmount = Number(p.amount);
          supplierCurrency = String(p.currency).toUpperCase();
        } else {
          // Proof supplied but invalid → block for public, allow office to try legacy fallback
          if (!office) {
            return res.status(424).json({
              message: "Supplier valuation unavailable",
              code: "NO_PRICE",
              hint: "Missing/invalid offerProof. Refresh availability and retry.",
            });
          }
        }
      }

      // Office-only legacy fallback from originalAmount/originalCurrency
      if ((!supplierAmount || !supplierCurrency) && office) {
        const oa = Number(originalAmountQ || 0);
        const oc = (originalCurrencyQ || "").toString().toUpperCase();
        if (oa > 0 && /^[A-Z]{3}$/.test(oc)) {
          supplierAmount = oa;
          supplierCurrency = oc;
        }
      }
    }

    // If still no price → fail
    if (!supplierAmount || !supplierCurrency) {
      return res.status(424).json({
        message: "Supplier valuation unavailable",
        code: "NO_PRICE",
        hint: "Please refresh availability (or send offerProof) and retry.",
        ...(req.query?.debugXml === "1" && raw?.__rawXml
          ? { debugXmlSnippet: String(raw.__rawXml).slice(0, 900) }
          : {}),
      });
    }

    /* ---------- 4) Role-based markup ---------- */
    const roleMarkupPct = await getRoleMarkupPct(req);
    const markupAmount = Number(
      ((supplierAmount * roleMarkupPct) / 100).toFixed(2)
    );
    const totalAmount = Number((supplierAmount + markupAmount).toFixed(2));

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
    const supplierAmountAmd = toAMD(supplierAmount, supplierCurrency);
    const markupAmountAmd = toAMD(markupAmount, supplierCurrency);
    const totalAmountAmd = toAMD(totalAmount, supplierCurrency);

    /* ---------- 6) Supplier vs Platform cancellation (bufferDays) ---------- */
    const safetyBufferDays = Number(
      process.env.BOOKING_SAFETY_BUFFER_DAYS || 4
    );
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
        // legacy flat fields (public view)
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

    /* ---------- 7) Remarks (annotate platform policy; show supplier cutoff only to office) ---------- */
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

    /* ---------- 8) Optional pay-at-hotel hint ---------- */
    const payAtHotelNote = (() => {
      const s = String(supplierRemarksHtml || "");
      if (/city\s*tax/i.test(s) || /payable\s+at\s+hotel/i.test(s)) {
        return "City/Local tax payable at hotel (see remarks).";
      }
      return null;
    })();

    /* ---------- 9) Response ---------- */
    return res.json({
      valuation: {
        price: { amount: totalAmount, currency: supplierCurrency },
        supplierPrice: { amount: supplierAmount, currency: supplierCurrency },
        cancellation: office ? cancellationFull : cancellationPublic,
        breakdown: {
          supplierBase: { amount: supplierAmount, currency: supplierCurrency },
          markup: { amount: markupAmount, currency: supplierCurrency },
          total: { amount: totalAmount, currency: supplierCurrency },
          supplierBaseAmd: supplierAmountAmd,
          markupAmd: markupAmountAmd,
          totalAmd: totalAmountAmd,
          exchange: {
            base: "AMD",
            usedRateFor: supplierCurrency,
            rate: getRate(supplierCurrency),
            lastUpdatedAt:
              settingsDoc?.ratesUpdatedAt || settingsDoc?.updatedAt || null,
          },
          taxesAndFees: { payAtHotelNote },
        },
        remarks: supplierRemarksHtml,
        remarksAnnotatedHtml,
      },
      meta: {
        provider: "goglobal",
        roleMarkupPct,
        safety: { bufferDays: safetyBufferDays },
      },
    });
  } catch (e) {
    if (/Supplier Error\s+315/i.test(String(e.message))) {
      return res.status(409).json({
        message: "Supplier session not found",
        hint: "Please refresh availability and retry valuation within the same session.",
        code: 315,
      });
    }
    console.error("❌ goglobalValuation error:", e);
    return res
      .status(500)
      .json({ message: "Valuation failed", error: e.message });
  }
};

// GET /api/v1/suppliers/goglobal/hotel-info
export const goglobalHotelInfo = async (req, res) => {
  try {
    const hotelId = req.query?.hotelId || req.params?.hotelId;
    const lang = req.query?.lang || "en";
    if (!hotelId) {
      return res.status(400).json({ message: "hotelId is required" });
    }

    const payload = await hotelInfo({
      hotelId: String(hotelId),
      language: String(lang),
      responseFormat: "JSON",
    });

    // normalize (rich version)
    const Main = payload?.Main || payload?.Root?.Main;
    let out = {
      hotelId: String(hotelId),
      name: "",
      address: "",
      cityId: "",
      category: 0,
      descriptionHtml: "",
      facilitiesHtml: "",
      roomFacilitiesHtml: "",
      facilities: [],
      roomFacilities: [],
      checkinTime: null,
      checkoutTime: null,
      pictures: [],
    };

    if (Main) {
      const textToList = (html) =>
        String(html || "")
          .replace(/<br\s*\/?>/gi, "\n")
          .replace(/<\/?[^>]+>/g, "")
          .split(/\n+/)
          .map((s) => s.trim())
          .filter(Boolean);

      out = {
        hotelId: String(Main.HotelId || hotelId),
        name: String(Main.HotelName || ""),
        address: String(Main.Address || ""),
        cityId: String(Main.CityCode || ""),
        category: toNum(Main.Category, 0),
        descriptionHtml: String(Main.Description || ""),
        facilitiesHtml: String(Main.HotelFacilities || ""),
        roomFacilitiesHtml: String(Main.RoomFacilities || ""),
        facilities: textToList(Main.HotelFacilities),
        roomFacilities: textToList(Main.RoomFacilities),
        checkinTime:
          String(Main.Description || "").match(
            /Checkin Time:\s*([0-9:]+)/i
          )?.[1] || null,
        checkoutTime:
          String(Main.Description || "").match(
            /Checkout (?:From|Time):\s*([0-9:]+)/i
          )?.[1] || null,
        pictures: _coerceArr(Main?.Pictures?.Picture)
          .map((p, i) => {
            const raw = (
              p?._ ||
              p["#text"] ||
              p.text ||
              p.url ||
              ""
            ).toString();
            const url = raw.replace(/<\/?[^>]+>/g, "").trim();
            const isMain =
              /primary|main/i.test(String(p?.$?.Description || "")) || i === 0;
            return url ? { url, isMain } : null;
          })
          .filter(Boolean),
      };
    } else if (payload?.__rawXml) {
      const xml = payload.__rawXml;
      const pick = (tag) => {
        const m = xml.match(new RegExp(`<${tag}>([\\s\\S]*?)<\\/${tag}>`, "i"));
        return m ? m[1].trim() : "";
      };
      const unesc = (s) =>
        String(s || "")
          .replace(/&lt;/g, "<")
          .replace(/&gt;/g, ">")
          .replace(/&amp;/g, "&");

      const descriptionHtml = unesc(pick("Description"));
      const facilitiesHtml = unesc(pick("HotelFacilities"));
      const roomFacilitiesHtml = unesc(pick("RoomFacilities"));
      const picsBlock =
        xml.match(/<Pictures>([\s\S]*?)<\/Pictures>/i)?.[1] ?? "";
      const urls = Array.from(
        picsBlock.matchAll(/<!\[CDATA\[([^\]]+)\]\]>/g)
      ).map((m) => m[1].trim());
      out = {
        hotelId: String(hotelId),
        name: unesc(pick("HotelName")),
        address: unesc(pick("Address")),
        cityId: unesc(pick("CityCode")),
        category: toNum(unesc(pick("Category")), 0),
        descriptionHtml,
        facilitiesHtml,
        roomFacilitiesHtml,
        facilities: facilitiesHtml
          .replace(/<br\s*\/?>/gi, "\n")
          .replace(/<\/?[^>]+>/g, "")
          .split(/\n+/)
          .map((s) => s.trim())
          .filter(Boolean),
        roomFacilities: roomFacilitiesHtml
          .replace(/<br\s*\/?>/gi, "\n")
          .replace(/<\/?[^>]+>/g, "")
          .split(/\n+/)
          .map((s) => s.trim())
          .filter(Boolean),
        checkinTime:
          descriptionHtml.match(/Checkin Time:\s*([0-9:]+)/i)?.[1] || null,
        checkoutTime:
          descriptionHtml.match(/Checkout (?:From|Time):\s*([0-9:]+)/i)?.[1] ||
          null,
        pictures: urls.map((u, i) => ({ url: u, isMain: i === 0 })),
      };
    }

    res.json({ hotel: out, meta: { provider: "goglobal" } });
  } catch (e) {
    console.error("❌ goglobalHotelInfo error:", e);
    res.status(500).json({ message: "Hotel info failed", error: e.message });
  }
};