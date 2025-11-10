// // controllers/hotelOrdersController.js

// import HotelOrder from "../models/HotelOrder.js";
// import { isOps, getUserId } from "../utils/acl.js";
// import {
//   deriveLeadName,
//   deriveRoomsCount,
//   derivePaid,
// } from "../services/orders/derivers.js";

// import {
//   labelPlatformStatus,
//   normalizePlatformStatusInput,
//   mapSupplierToPlatform,
// } from "../services/orders/status.js";

// import { bookingStatus } from "../services/goglobalClient.js";

// const TERMINAL = new Set(["X", "RJ"]); // cancelled / rejected

// /** try to live-refresh a single order from supplier; returns true if changed */
// async function refreshFromSupplier(doc) {
//   const goCode = doc?.supplier?.bookingCode;
//   if (!goCode) return false;

//   try {
//     const st = await bookingStatus({ goBookingCode: goCode });
//     // supplier may return: { Status: "X" } or { status: { status: "X" } } or { status: "X" }
//     const raw =
//       String(st?.Status || st?.status?.status || st?.status || "")
//         .trim()
//         .toUpperCase() || null;

//     if (!raw) return false;

//     const platform = mapSupplierToPlatform(raw);
//     let changed = false;

//     if (doc?.supplier?.rawStatus !== raw) {
//       doc.supplier = doc.supplier || {};
//       doc.supplier.rawStatus = raw;
//       doc.markModified("supplier");
//       changed = true;
//     }
//     if (platform && doc.status !== platform) {
//       doc.status = platform;
//       changed = true;
//     }

//     if (changed) {
//       await doc.save();
//     }
//     return changed;
//   } catch (e) {
//     // do not break page render because of supplier hiccups
//     return false;
//   }
// }

// /** sanitize order output for a given role */
// function maskOrder(orderDoc, role) {
//   const o = orderDoc.toObject ? orderDoc.toObject() : orderDoc;

//   const summary = {
//     platformRef: o.platformRef,
//     agentRef: o.agentRef || "",
//     agency: o.agencyName || null,
//     user: o.userEmail || null,

//     status: o.status,
//     statusLabel: labelPlatformStatus(o.status),

//     city: o.hotel?.cityName || null,
//     service: o.hotel?.name || null,
//     rooms: o.context?.roomsCount ?? deriveRoomsCount(o.rooms),
//     leadName: deriveLeadName(o.rooms),

//     cancellation: {
//       refundable: o.cancellation?.refundable ?? null,
//       platformCutoffUtc: o.cancellation?.platformCutoffUtc ?? null,
//     },

//     price: {
//       amount: o.price?.amount ?? 0,
//       currency: o.price?.currency ?? null,
//     },

//     arrivalDate: o.context?.arrivalDate || null,
//     nights: o.context?.nights ?? 1,
//     paid: derivePaid(o.payment),
//   };

//   if (isOps(role)) {
//     summary._ops = {
//       supplier: o.supplier?.code || null,
//       supplierRef: o.supplier?.supplierRef || null,
//       supplierBookingCode: o.supplier?.bookingCode || null,
//       rawStatus: o.supplier?.rawStatus || null,
//     };
//   }

//   return summary;
// }

// export async function listHotelOrders(req, res) {
//   try {
//     const {
//       q,
//       status, // C/RQ/... կամ CONFIRMED/...
//       page = 1,
//       limit = 20,
//       sort = "-createdAt",
//     } = req.query;

//     const role = req.user?.role;
//     const where = {};

//     if (!isOps(role)) {
//       where.userId = req.user?._id || req.user?.id;
//     }

//     if (status) {
//       const norm = normalizePlatformStatusInput(status);
//       if (!norm)
//         return res.status(400).json({ message: "Invalid status filter" });
//       where.status = norm;
//     }

//     if (q) {
//       const rx = new RegExp(
//         String(q).replace(/[.*+?^${}()|[\]\\]/g, "\\$&"),
//         "i"
//       );
//       where.$or = [
//         { platformRef: rx },
//         { agentRef: rx },
//         { "summary.userEmail": rx },
//         { "summary.userName": rx },
//         { "summary.leadName": rx },
//         { "hotel.name": rx },
//         { "hotel.cityName": rx },
//       ];
//     }

//     const pageNum = Math.max(parseInt(page, 10) || 1, 1);
//     const pageSize = Math.min(Math.max(parseInt(limit, 10) || 20, 1), 100);

//     const projection = {
//       platformRef: 1,
//       agentRef: 1,
//       status: 1,
//       "hotel.name": 1,
//       "hotel.cityName": 1,
//       summary: 1,
//       createdAt: 1,
//     };

//     const [docs, total] = await Promise.all([
//       HotelOrder.find(where)
//         .select(projection)
//         .sort(sort)
//         .skip((pageNum - 1) * pageSize)
//         .limit(pageSize)
//         .lean(),
//       HotelOrder.countDocuments(where),
//     ]);

//     const items = docs.map((o) => {
//       const agentRef = o.agentRef || o.summary?.agentRef || "";
//       const userName = o.summary?.userName || null;
//       const email = o.summary?.userEmail || null;

//       const city = o.summary?.city ?? o.hotel?.cityName ?? null;
//       const hotel = o.summary?.service ?? o.hotel?.name ?? null;

//       const rooms = Number.isFinite(o?.summary?.rooms) ? o.summary.rooms : 1;

//       const lead = o?.summary?.leadName ?? null;

//       const refundable = o?.summary?.cancellation?.refundable;
//       const cutoff = o?.summary?.cancellation?.platformCutoffUtc;
//       const freeCancellation = refundable
//         ? cutoff
//           ? {
//               label: `Until ${new Date(cutoff).toISOString().slice(0, 10)}`,
//               date: new Date(cutoff).toISOString().slice(0, 10),
//             }
//           : { label: "Check policy", date: null }
//         : { label: "non-refundable", date: null };

//       const arrivalDate = o?.summary?.arrivalDate ?? null;
//       const nights = Number.isFinite(o?.summary?.nights)
//         ? o.summary.nights
//         : null;

//       const amount = Number.isFinite(o?.summary?.price?.amount)
//         ? o.summary.price.amount
//         : null;
//       const currency = o?.summary?.price?.currency || null;

//       return {
//         platformRef: o.platformRef,
//         agentRef,
//         user: { name: userName, email },
//         status: o.status,
//         city,
//         hotel,
//         rooms,
//         lead,
//         freeCancellation,
//         arrivalDate,
//         nights,
//         price: { amount, currency },
//         viewUrl: `/admin/bookings/details/${encodeURIComponent(
//           o.platformRef
//         )}?refresh=1`,
//       };
//     });

//     return res.json({ items, page: pageNum, limit: pageSize, total });
//   } catch (err) {
//     console.error("listHotelOrders error", err);
//     return res.status(500).json({ message: "Failed to fetch hotel orders" });
//   }
// }

// export async function getHotelOrder(req, res) {
//   try {
//     const { platformRef } = req.params;
//     if (!platformRef) {
//       return res.status(400).json({ message: "platformRef is required" });
//     }

//     const role = req.user?.role;
//     const baseQuery = { platformRef };

//     if (!isOps(role)) baseQuery.userId = getUserId(req);

//     let doc = await HotelOrder.findOne(baseQuery);
//     if (!doc) return res.status(404).json({ message: "Order not found" });

//     // Live refresh when explicitly asked, or when status is non-terminal
//     const mustRefresh =
//       String(req.query?.refresh || "") === "1" ||
//       !TERMINAL.has(String(doc.status || "").toUpperCase());

//     if (mustRefresh) {
//       await refreshFromSupplier(doc);
//     }

//     // re-read snapshot after potential update
//     const fresh = await HotelOrder.findById(doc._id);
//     const o = (fresh || doc).toObject();

//     const summary = {
//       agentRef: o.agentRef || "",
//       agency: o.agencyName || null,
//       userEmail: o.userEmail || null,
//       city: o.hotel?.cityName || null,
//       service: o.hotel?.name || null,
//       rooms: o.context?.roomsCount ?? deriveRoomsCount(o.rooms),
//       leadName: deriveLeadName(o.rooms),
//       arrivalDate: o.context?.arrivalDate || null,
//       nights: o.context?.nights ?? 1,
//       cancellation: {
//         refundable: o.cancellation?.refundable ?? null,
//         platformCutoffUtc: o.cancellation?.platformCutoffUtc ?? null,
//       },
//       price: {
//         amount: o.price?.amount ?? 0,
//         currency: o.price?.currency ?? null,
//       },
//       sellingPrice: {
//         amount: o.price?.amount ?? 0,
//         currency: o.price?.currency ?? null,
//       },
//       paid: derivePaid(o.payment),
//       user: {
//         id: o.userId ?? null,
//         email: o.userEmail ?? o.summary?.userEmail ?? null,
//         name: o.summary?.userName ?? null,
//       },
//     };

//     const hotelMini = {
//       id: o.hotel?.id || null,
//       name: o.hotel?.name || null,
//       category: o.hotel?.category ?? null,
//       address: o.hotel?.address || null,
//       city: o.hotel?.cityName || null,
//       country: o.hotel?.countryName || null,
//       image: o.hotel?.image || null,
//     };

//     const details = {
//       hotel: hotelMini,
//       context: {
//         hotelSearchCode: o.context?.hotelSearchCode || null,
//         arrivalDate: o.context?.arrivalDate || null,
//         nights: o.context?.nights ?? null,
//         roomBasis: o.context?.roomBasis || null,
//       },
//       rooms: (o.rooms || []).map((r) => ({
//         roomId: r.roomId,
//         category: r.category || null,
//         pax: (r.pax || []).map((p) => ({
//           type: p.type === "child" ? "CHD" : "ADT",
//           title: p.title || null,
//           firstName: p.firstName,
//           lastName: p.lastName,
//           age: p.type === "child" ? p.age ?? null : undefined,
//         })),
//       })),
//       cancellation: {
//         supplier: {
//           refundable: null,
//           deadlineUtc: null,
//         },
//         platform: {
//           refundable: o.cancellation?.refundable ?? null,
//           cutoffUtc: o.cancellation?.platformCutoffUtc ?? null,
//           bufferDays: null,
//           reason: null,
//         },
//         hoursUntilSupplierDeadline: null,
//         refundable: o.cancellation?.refundable ?? null,
//         supplierDeadlineUtc: null,
//         platformCutoffUtc: o.cancellation?.platformCutoffUtc ?? null,
//         safeToBook: null,
//         bufferDays: null,
//       },
//       remarksHtml: o.supplierRemarksHtml || null,
//       price: {
//         retail: {
//           amount: o.price?.amount ?? 0,
//           currency: o.price?.currency ?? null,
//         },
//         net: (() => {
//           if (!isOps(role)) return { amount: null, currency: null };
//           const cur = o.price?.currency ?? null;
//           const storedAmt = o?.supplierNet?.amount;
//           const storedCur = o?.supplierNet?.currency ?? cur;
//           if (typeof storedAmt === "number") {
//             return { amount: storedAmt, currency: storedCur ?? null };
//           }
//           const retail = o.price?.amount;
//           const mpct =
//             typeof o.price?.markupPct === "number" ? o.price.markupPct : null;
//           if (typeof retail === "number" && mpct !== null) {
//             const netCalc = Math.round((retail / (1 + mpct / 100)) * 100) / 100;
//             return { amount: netCalc, currency: cur };
//           }
//           return { amount: null, currency: cur };
//         })(),
//       },
//     };

//     const payment = o.payment || {
//       status: "unpaid",
//       method: null,
//       provider: null,
//       history: [],
//     };

//     const order = {
//       platformRef: o.platformRef,
//       status: o.status,
//       statusLabel: labelPlatformStatus(o.status),
//       role: o.role || role || null,
//       summary,
//       details,
//       payment,
//     };

//     if (isOps(role)) {
//       order.supplier = {
//         code: o.supplier?.code || "goglobal",
//         bookingCode: o.supplier?.bookingCode || null,
//         rawStatus: o.supplier?.rawStatus || null,
//         name: "Go Global",
//         reference: o.supplier?.supplierRef || null,
//       };
//       order._ops = {
//         rawStatus: o.supplier?.rawStatus || null,
//       };
//     }

//     return res.json({ order });
//   } catch (e) {
//     console.error("getHotelOrder error:", e);
//     res.status(500).json({ message: "Failed to load order" });
//   }
// }

// export async function patchAgentRef(req, res) {
//   try {
//     const { platformRef } = req.params;
//     const { agentRef } = req.body || {};
//     if (!platformRef)
//       return res.status(400).json({ message: "platformRef is required" });

//     const baseQuery = { platformRef };
//     if (!isOps(req.user?.role)) baseQuery.userId = getUserId(req);

//     const doc = await HotelOrder.findOneAndUpdate(
//       baseQuery,
//       { $set: { agentRef: String(agentRef || "") } },
//       { new: true }
//     );
//     if (!doc) return res.status(404).json({ message: "Order not found" });

//     res.json({ ok: true, summary: maskOrder(doc, req.user?.role) });
//   } catch (e) {
//     console.error("patchAgentRef error:", e);
//     res.status(500).json({ message: "Failed to update agentRef" });
//   }
// }

// // controllers/hotelOrdersController.js
// import HotelOrder from "../models/HotelOrder.js";
// import { isOps, getUserId } from "../utils/acl.js";
// import { deriveLeadName, deriveRoomsCount, derivePaid } from "../services/orders/derivers.js";
// import { labelPlatformStatus, normalizePlatformStatusInput, mapSupplierToPlatform } from "../services/orders/status.js";
// import { bookingStatus } from "../services/goglobalClient.js";

// const TERMINAL = new Set(["X", "RJ"]); // cancelled / rejected

// /** Robustly extract supplier status code from various shapes */
// function extractSupplierStatus(st) {
//   // common shapes:
//   // 1) { Status: "X" }
//   // 2) { status: "X" }
//   // 3) { status: { status: "X", ... } }
//   // 4) { Status: { Status: "X" } } – զգուշության համար
//   if (!st) return null;

//   const tryVal = (v) => (typeof v === "string" && v.trim() ? v.trim().toUpperCase() : null);

//   // direct string fields
//   let code = tryVal(st.Status) || tryVal(st.status);
//   if (code) return code;

//   // nested object { status: { status: "X" } } or { Status: { Status: "X" } }
//   if (st.status && typeof st.status === "object") {
//     code = tryVal(st.status.Status) || tryVal(st.status.status);
//     if (code) return code;
//   }
//   if (st.Status && typeof st.Status === "object") {
//     code = tryVal(st.Status.Status) || tryVal(st.Status.status);
//     if (code) return code;
//   }

//   return null;
// }

// /** Try to refresh order status from supplier; persist only if changed */
// async function refreshFromSupplier(doc) {
//   const goCode = doc?.supplier?.bookingCode;
//   if (!goCode) return false;

//   try {
//     const st = await bookingStatus({ goBookingCode: goCode });
//     const raw = extractSupplierStatus(st);
//     if (!raw) {
//       // keep quiet; nothing to map
//       return false;
//     }
//     const mapped = mapSupplierToPlatform(raw); // e.g. "X" | "C" | ...
//     const prevRaw = doc?.supplier?.rawStatus || null;
//     const prev = String(doc.status || "").toUpperCase();

//     if (prevRaw !== raw || prev !== mapped) {
//       doc.supplier = doc.supplier || {};
//       doc.supplier.rawStatus = raw;
//       if (mapped) doc.status = mapped;
//       await doc.save();
//       return true;
//     }
//   } catch (e) {
//     // do not block the view; optionally log
//     console.warn("[orders] supplier refresh failed:", e?.message || e);
//   }
//   return false;
// }

// /** sanitize order output for a given role */
// function maskOrder(orderDoc, role) {
//   const o = orderDoc.toObject ? orderDoc.toObject() : orderDoc;

//   const summary = {
//     platformRef: o.platformRef,
//     agentRef: o.agentRef || "",
//     agency: o.agencyName || null,
//     user: o.userEmail || null,

//     status: o.status,
//     statusLabel: labelPlatformStatus(o.status),

//     city: o.hotel?.cityName || null,
//     service: o.hotel?.name || null,
//     rooms: o.context?.roomsCount ?? deriveRoomsCount(o.rooms),
//     leadName: deriveLeadName(o.rooms),

//     cancellation: {
//       refundable: o.cancellation?.refundable ?? null,
//       platformCutoffUtc: o.cancellation?.platformCutoffUtc ?? null,
//     },

//     price: {
//       amount: o.price?.amount ?? 0,
//       currency: o.price?.currency ?? null,
//     },

//     arrivalDate: o.context?.arrivalDate || null,
//     nights: o.context?.nights ?? 1,
//     paid: derivePaid(o.payment),
//   };

//   if (isOps(role)) {
//     summary._ops = {
//       supplier: o.supplier?.code || null,
//       supplierRef: o.supplier?.supplierRef || null,
//       supplierBookingCode: o.supplier?.bookingCode || null,
//       rawStatus: o.supplier?.rawStatus || null,
//     };
//   }

//   return summary;
// }

// export async function listHotelOrders(req, res) {
//   try {
//     const { q, status, page = 1, limit = 20, sort = "-createdAt" } = req.query;
//     const role = req.user?.role;
//     const where = {};

//     if (!isOps(role)) {
//       where.userId = req.user?._id || req.user?.id;
//     }

//     if (status) {
//       const norm = normalizePlatformStatusInput(status);
//       if (!norm) return res.status(400).json({ message: "Invalid status filter" });
//       where.status = norm;
//     }

//     if (q) {
//       const rx = new RegExp(String(q).replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
//       where.$or = [
//         { platformRef: rx },
//         { agentRef: rx },
//         { "summary.userEmail": rx },
//         { "summary.userName": rx },
//         { "summary.leadName": rx },
//         { "hotel.name": rx },
//         { "hotel.cityName": rx },
//       ];
//     }

//     const pageNum = Math.max(parseInt(page, 10) || 1, 1);
//     const pageSize = Math.min(Math.max(parseInt(limit, 10) || 20, 1), 100);

//     const projection = {
//       platformRef: 1,
//       agentRef: 1,
//       status: 1,
//       "hotel.name": 1,
//       "hotel.cityName": 1,
//       summary: 1,
//       createdAt: 1,
//     };

//     const [docs, total] = await Promise.all([
//       HotelOrder.find(where).select(projection).sort(sort).skip((pageNum - 1) * pageSize).limit(pageSize).lean(),
//       HotelOrder.countDocuments(where),
//     ]);

//     const items = docs.map((o) => {
//       const agentRef = o.agentRef || o.summary?.agentRef || "";
//       const userName = o.summary?.userName || null;
//       const email = o.summary?.userEmail || null;

//       const city = o.summary?.city ?? o.hotel?.cityName ?? null;
//       const hotel = o.summary?.service ?? o.hotel?.name ?? null;

//       const rooms = Number.isFinite(o?.summary?.rooms) ? o.summary.rooms : 1;
//       const lead = o?.summary?.leadName ?? null;

//       const refundable = o?.summary?.cancellation?.refundable;
//       const cutoff = o?.summary?.cancellation?.platformCutoffUtc;
//       const freeCancellation = refundable
//         ? cutoff
//           ? { label: `Until ${new Date(cutoff).toISOString().slice(0, 10)}`, date: new Date(cutoff).toISOString().slice(0, 10) }
//           : { label: "Check policy", date: null }
//         : { label: "non-refundable", date: null };

//       const arrivalDate = o?.summary?.arrivalDate ?? null;
//       const nights = Number.isFinite(o?.summary?.nights) ? o.summary.nights : null;

//       const amount = Number.isFinite(o?.summary?.price?.amount) ? o.summary.price.amount : null;
//       const currency = o?.summary?.price?.currency || null;

//       return {
//         platformRef: o.platformRef,
//         agentRef,
//         user: { name: userName, email },
//         status: o.status,
//         city,
//         hotel,
//         rooms,
//         lead,
//         freeCancellation,
//         arrivalDate,
//         nights,
//         price: { amount, currency },
//         viewUrl: `/admin/bookings/details/${encodeURIComponent(o.platformRef)}?refresh=1`,
//       };
//     });

//     return res.json({ items, page: pageNum, limit: pageSize, total });
//   } catch (err) {
//     console.error("listHotelOrders error", err);
//     return res.status(500).json({ message: "Failed to fetch hotel orders" });
//   }
// }

// export async function getHotelOrder(req, res) {
//   try {
//     const { platformRef } = req.params;
//     if (!platformRef) return res.status(400).json({ message: "platformRef is required" });

//     const role = req.user?.role;
//     const baseQuery = { platformRef };
//     if (!isOps(role)) baseQuery.userId = getUserId(req);

//     let doc = await HotelOrder.findOne(baseQuery);
//     if (!doc) return res.status(404).json({ message: "Order not found" });

//     // live refresh (explicit ?refresh=1 or non-terminal states)
//     const doRefresh = String(req.query?.refresh || "") === "1" || !TERMINAL.has(String(doc.status || "").toUpperCase());
//     if (doRefresh) {
//       const changed = await refreshFromSupplier(doc);
//       if (changed) {
//         // re-read fresh snapshot for response consistency
//         doc = await HotelOrder.findById(doc._id);
//       }
//     }

//     const o = doc.toObject();

//     const summary = {
//       agentRef: o.agentRef || "",
//       agency: o.agencyName || null,
//       userEmail: o.userEmail || null,
//       city: o.hotel?.cityName || null,
//       service: o.hotel?.name || null,
//       rooms: o.context?.roomsCount ?? deriveRoomsCount(o.rooms),
//       leadName: deriveLeadName(o.rooms),
//       arrivalDate: o.context?.arrivalDate || null,
//       nights: o.context?.nights ?? 1,
//       cancellation: {
//         refundable: o.cancellation?.refundable ?? null,
//         platformCutoffUtc: o.cancellation?.platformCutoffUtc ?? null,
//       },
//       price: {
//         amount: o.price?.amount ?? 0,
//         currency: o.price?.currency ?? null,
//       },
//       sellingPrice: {
//         amount: o.price?.amount ?? 0,
//         currency: o.price?.currency ?? null,
//       },
//       paid: derivePaid(o.payment),
//       user: {
//         id: o.userId ?? null,
//         email: o.userEmail ?? o.summary?.userEmail ?? null,
//         name: o.summary?.userName ?? null,
//       },
//     };

//     const hotelMini = {
//       id: o.hotel?.id || null,
//       name: o.hotel?.name || null,
//       category: o.hotel?.category ?? null,
//       address: o.hotel?.address || null,
//       city: o.hotel?.cityName || null,
//       country: o.hotel?.countryName || null,
//       image: o.hotel?.image || null,
//     };

//     const details = {
//       hotel: hotelMini,
//       context: {
//         hotelSearchCode: o.context?.hotelSearchCode || null,
//         arrivalDate: o.context?.arrivalDate || null,
//         nights: o.context?.nights ?? null,
//         roomBasis: o.context?.roomBasis || null,
//       },
//       rooms: (o.rooms || []).map((r) => ({
//         roomId: r.roomId,
//         category: r.category || null,
//         pax: (r.pax || []).map((p) => ({
//           type: p.type === "child" ? "CHD" : "ADT",
//           title: p.title || null,
//           firstName: p.firstName,
//           lastName: p.lastName,
//           age: p.type === "child" ? p.age ?? null : undefined,
//         })),
//       })),
//       cancellation: {
//         supplier: { refundable: null, deadlineUtc: null },
//         platform: {
//           refundable: o.cancellation?.refundable ?? null,
//           cutoffUtc: o.cancellation?.platformCutoffUtc ?? null,
//           bufferDays: null,
//           reason: null,
//         },
//         hoursUntilSupplierDeadline: null,
//         refundable: o.cancellation?.refundable ?? null,
//         supplierDeadlineUtc: null,
//         platformCutoffUtc: o.cancellation?.platformCutoffUtc ?? null,
//         safeToBook: null,
//         bufferDays: null,
//       },
//       remarksHtml: o.supplierRemarksHtml || null,
//       price: {
//         retail: { amount: o.price?.amount ?? 0, currency: o.price?.currency ?? null },
//         net: (() => {
//           if (!isOps(role)) return { amount: null, currency: null };
//           const cur = o.price?.currency ?? null;
//           const storedAmt = o?.supplierNet?.amount;
//           const storedCur = o?.supplierNet?.currency ?? cur;
//           if (typeof storedAmt === "number") return { amount: storedAmt, currency: storedCur ?? null };
//           const retail = o.price?.amount;
//           const mpct = typeof o.price?.markupPct === "number" ? o.price.markupPct : null;
//           if (typeof retail === "number" && mpct !== null) {
//             const netCalc = Math.round((retail / (1 + mpct / 100)) * 100) / 100;
//             return { amount: netCalc, currency: cur };
//           }
//           return { amount: null, currency: cur };
//         })(),
//       },
//     };

//     const payment = o.payment || { status: "unpaid", method: null, provider: null, history: [] };

//     const order = {
//       platformRef: o.platformRef,
//       status: o.status,
//       statusLabel: labelPlatformStatus(o.status),
//       role: o.role || role || null,
//       summary,
//       details,
//       payment,
//     };

//     if (isOps(role)) {
//       order.supplier = {
//         code: o.supplier?.code || "goglobal",
//         bookingCode: o.supplier?.bookingCode || null,
//         rawStatus: o.supplier?.rawStatus || null,
//         name: "Go Global",
//         reference: o.supplier?.supplierRef || null,
//       };
//       order._ops = { rawStatus: o.supplier?.rawStatus || null };
//     }

//     return res.json({ order });
//   } catch (e) {
//     console.error("getHotelOrder error:", e);
//     res.status(500).json({ message: "Failed to load order" });
//   }
// }

// export async function patchAgentRef(req, res) {
//   try {
//     const { platformRef } = req.params;
//     const { agentRef } = req.body || {};
//     if (!platformRef) return res.status(400).json({ message: "platformRef is required" });

//     const baseQuery = { platformRef };
//     if (!isOps(req.user?.role)) baseQuery.userId = getUserId(req);

//     const doc = await HotelOrder.findOneAndUpdate(
//       baseQuery,
//       { $set: { agentRef: String(agentRef || "") } },
//       { new: true }
//     );
//     if (!doc) return res.status(404).json({ message: "Order not found" });

//     res.json({ ok: true, summary: maskOrder(doc, req.user?.role) });
//   } catch (e) {
//     console.error("patchAgentRef error:", e);
//     res.status(500).json({ message: "Failed to update agentRef" });
//   }
// }

// controllers/hotelOrdersController.js

import HotelOrder from "../models/HotelOrder.js";
import { isOps, getUserId } from "../utils/acl.js";
import {
  deriveLeadName,
  deriveRoomsCount,
  derivePaid,
} from "../services/orders/derivers.js";

import {
  labelPlatformStatus,
  normalizePlatformStatusInput,
  mapSupplierToPlatform,
} from "../services/orders/status.js";

import { bookingStatus } from "../services/goglobalClient.js";

const TERMINAL = new Set(["X", "RJ"]); // cancelled / rejected

/** sanitize order output for a given role */
function maskOrder(orderDoc, role) {
  const o = orderDoc.toObject ? orderDoc.toObject() : orderDoc;

  const summary = {
    platformRef: o.platformRef,
    agentRef: o.agentRef || "",
    agency: o.agencyName || null,
    user: o.userEmail || null,

    status: o.status,
    statusLabel: labelPlatformStatus(o.status),

    city: o.hotel?.cityName || null,
    service: o.hotel?.name || null,
    rooms: o.context?.roomsCount ?? deriveRoomsCount(o.rooms),
    leadName: deriveLeadName(o.rooms),

    cancellation: {
      refundable: o.cancellation?.refundable ?? null,
      platformCutoffUtc: o.cancellation?.platformCutoffUtc ?? null,
    },

    price: {
      amount: o.price?.amount ?? 0,
      currency: o.price?.currency ?? null,
    },

    arrivalDate: o.context?.arrivalDate || null,
    nights: o.context?.nights ?? 1,
    paid: derivePaid(o.payment),
  };

  if (isOps(role)) {
    summary._ops = {
      supplier: o.supplier?.code || null,
      supplierRef: o.supplier?.supplierRef || null,
      supplierBookingCode: o.supplier?.bookingCode || null,
      rawStatus: o.supplier?.rawStatus || null,
    };
  }

  return summary;
}

export async function listHotelOrders(req, res) {
  try {
    const { q, status, page = 1, limit = 20, sort = "-createdAt" } = req.query;

    const role = req.user?.role;
    const where = {};

    if (!isOps(role)) {
      where.userId = req.user?._id || req.user?.id;
    }

    if (status) {
      const norm = normalizePlatformStatusInput(status);
      if (!norm)
        return res.status(400).json({ message: "Invalid status filter" });
      where.status = norm;
    }

    if (q) {
      const rx = new RegExp(
        String(q).replace(/[.*+?^${}()|[\]\\]/g, "\\$&"),
        "i"
      );
      where.$or = [
        { platformRef: rx },
        { agentRef: rx },
        { "summary.userEmail": rx },
        { "summary.userName": rx },
        { "summary.leadName": rx },
        { "hotel.name": rx },
        { "hotel.cityName": rx },
      ];
    }

    const pageNum = Math.max(parseInt(page, 10) || 1, 1);
    const pageSize = Math.min(Math.max(parseInt(limit, 10) || 20, 1), 100);

    const projection = {
      platformRef: 1,
      agentRef: 1,
      status: 1,
      "hotel.name": 1,
      "hotel.cityName": 1,
      summary: 1,
      createdAt: 1,
    };

    const [docs, total] = await Promise.all([
      HotelOrder.find(where)
        .select(projection)
        .sort(sort)
        .skip((pageNum - 1) * pageSize)
        .limit(pageSize)
        .lean(),
      HotelOrder.countDocuments(where),
    ]);

    const items = docs.map((o) => {
      const agentRef = o.agentRef || o.summary?.agentRef || "";
      const userName = o.summary?.userName || null;
      const email = o.summary?.userEmail || null;

      const city = o.summary?.city ?? o.hotel?.cityName ?? null;
      const hotel = o.summary?.service ?? o.hotel?.name ?? null;

      const rooms = Number.isFinite(o?.summary?.rooms) ? o.summary.rooms : 1;

      const lead = o?.summary?.leadName ?? null;

      const refundable = o?.summary?.cancellation?.refundable;
      const cutoff = o?.summary?.cancellation?.platformCutoffUtc;
      const freeCancellation = refundable
        ? cutoff
          ? {
              label: `Until ${new Date(cutoff).toISOString().slice(0, 10)}`,
              date: new Date(cutoff).toISOString().slice(0, 10),
            }
          : { label: "Check policy", date: null }
        : { label: "non-refundable", date: null };

      const arrivalDate = o?.summary?.arrivalDate ?? null;
      const nights = Number.isFinite(o?.summary?.nights)
        ? o.summary.nights
        : null;

      const amount = Number.isFinite(o?.summary?.price?.amount)
        ? o.summary.price.amount
        : null;
      const currency = o?.summary?.price?.currency || null;

      return {
        platformRef: o.platformRef,
        agentRef,
        user: { name: userName, email },
        status: o.status,
        city,
        hotel,
        rooms,
        lead,
        freeCancellation,
        arrivalDate,
        nights,
        price: { amount, currency },
        viewUrl: `/admin/bookings/status/${encodeURIComponent(o.platformRef)}`,
      };
    });

    return res.json({ items, page: pageNum, limit: pageSize, total });
  } catch (err) {
    console.error("listHotelOrders error", err);
    return res.status(500).json({ message: "Failed to fetch hotel orders" });
  }
}

export async function getHotelOrder(req, res) {
  try {
    const { platformRef } = req.params;
    if (!platformRef) {
      return res.status(400).json({ message: "platformRef is required" });
    }

    const role = req.user?.role;
    const baseQuery = { platformRef };

    if (!isOps(role)) baseQuery.userId = getUserId(req);

    let doc = await HotelOrder.findOne(baseQuery);
    if (!doc) return res.status(404).json({ message: "Order not found" });

    // Live refresh: try supplier sync when asked or when non-terminal
    const wantRefresh =
      String(req.query?.refresh || "") === "1" ||
      !TERMINAL.has(String(doc.status || "").toUpperCase());

    if (wantRefresh) {
      const goCode = doc?.supplier?.bookingCode;
      if (goCode) {
        try {
          const st = await bookingStatus({ goBookingCode: goCode });
          const raw =
            String(
              st?.Status || st?.status || st?.status?.status || ""
            ).toUpperCase() || null;
          if (raw) {
            doc.supplier.rawStatus = raw;
            doc.status = mapSupplierToPlatform(raw);
            await doc.save();
          }
        } catch (e) {
          // swallow supplier errors
        }
      }
    }

    const fresh = await HotelOrder.findById(doc._id);
    const o = (fresh || doc).toObject();

    const summary = {
      agentRef: o.agentRef || "",
      agency: o.agencyName || null,
      userEmail: o.userEmail || null,
      city: o.hotel?.cityName || null,
      service: o.hotel?.name || null,
      rooms: o.context?.roomsCount ?? deriveRoomsCount(o.rooms),
      leadName: deriveLeadName(o.rooms),
      arrivalDate: o.context?.arrivalDate || null,
      nights: o.context?.nights ?? 1,
      cancellation: {
        refundable: o.cancellation?.refundable ?? null,
        platformCutoffUtc: o.cancellation?.platformCutoffUtc ?? null,
      },
      price: {
        amount: o.price?.amount ?? 0,
        currency: o.price?.currency ?? null,
      },
      sellingPrice: {
        amount: o.price?.amount ?? 0,
        currency: o.price?.currency ?? null,
      },
      paid: derivePaid(o.payment),
      user: {
        id: o.userId ?? null,
        email: o.userEmail ?? o.summary?.userEmail ?? null,
        name: o.summary?.userName ?? null,
      },
    };

    const hotelMini = {
      id: o.hotel?.id || null,
      name: o.hotel?.name || null,
      category: o.hotel?.category ?? null,
      address: o.hotel?.address || null,
      city: o.hotel?.cityName || null,
      country: o.hotel?.countryName || null,
      image: o.hotel?.image || null,
    };

    const details = {
      hotel: hotelMini,
      context: {
        hotelSearchCode: o.context?.hotelSearchCode || null,
        arrivalDate: o.context?.arrivalDate || null,
        nights: o.context?.nights ?? null,
        roomBasis: o.context?.roomBasis || null,
      },
      rooms: (o.rooms || []).map((r) => ({
        roomId: r.roomId,
        category: r.category || null,
        pax: (r.pax || []).map((p) => ({
          type: p.type === "child" ? "CHD" : "ADT",
          title: p.title || null,
          firstName: p.firstName,
          lastName: p.lastName,
          age: p.type === "child" ? p.age ?? null : undefined,
        })),
      })),
      cancellation: {
        supplier: {
          refundable: null,
          deadlineUtc: null,
        },
        platform: {
          refundable: o.cancellation?.refundable ?? null,
          cutoffUtc: o.cancellation?.platformCutoffUtc ?? null,
          bufferDays: null,
          reason: null,
        },
        hoursUntilSupplierDeadline: null,
        refundable: o.cancellation?.refundable ?? null,
        supplierDeadlineUtc: null,
        platformCutoffUtc: o.cancellation?.platformCutoffUtc ?? null,
        safeToBook: null,
        bufferDays: null,
      },
      remarksHtml: o.supplierRemarksHtml || null,
      price: {
        retail: {
          amount: o.price?.amount ?? 0,
          currency: o.price?.currency ?? null,
        },
        net: (() => {
          if (!isOps(role)) return { amount: null, currency: null };
          const cur = o.price?.currency ?? null;
          const storedAmt = o?.supplierNet?.amount;
          const storedCur = o?.supplierNet?.currency ?? cur;
          if (typeof storedAmt === "number") {
            return { amount: storedAmt, currency: storedCur ?? null };
          }
          const retail = o.price?.amount;
          const mpct =
            typeof o.price?.markupPct === "number" ? o.price.markupPct : null;
          if (typeof retail === "number" && mpct !== null) {
            const netCalc = Math.round((retail / (1 + mpct / 100)) * 100) / 100;
            return { amount: netCalc, currency: cur };
          }
          return { amount: null, currency: cur };
        })(),
      },
    };

    const payment = o.payment || {
      status: "unpaid",
      method: null,
      provider: null,
      history: [],
    };

    const order = {
      platformRef: o.platformRef,
      status: o.status,
      statusLabel: labelPlatformStatus(o.status),
      role: o.role || role || null,
      summary,
      details,
      payment,
      // pass-through remarks so FE can read them at top level
      clientRemark: o.clientRemark ?? null,
      supplierRemarksHtml: o.supplierRemarksHtml ?? null,
      createdAt: o.createdAt ?? null,
      updatedAt: o.updatedAt ?? null,
    };

    if (isOps(role)) {
      order.supplier = {
        code: o.supplier?.code || "goglobal",
        bookingCode: o.supplier?.bookingCode || null,
        rawStatus: o.supplier?.rawStatus || null,
        name: "Go Global",
        reference: o.supplier?.supplierRef || null,
      };
      order._ops = {
        rawStatus: o.supplier?.rawStatus || null,
      };
    }

    return res.json({ order });
  } catch (e) {
    console.error("getHotelOrder error:", e);
    res.status(500).json({ message: "Failed to load order" });
  }
}

export async function patchAgentRef(req, res) {
  try {
    const { platformRef } = req.params;
    const { agentRef } = req.body || {};
    if (!platformRef)
      return res.status(400).json({ message: "platformRef is required" });

    const baseQuery = { platformRef };
    if (!isOps(req.user?.role)) baseQuery.userId = getUserId(req);

    const doc = await HotelOrder.findOneAndUpdate(
      baseQuery,
      { $set: { agentRef: String(agentRef || "") } },
      { new: true }
    );
    if (!doc) return res.status(404).json({ message: "Order not found" });

    res.json({ ok: true, summary: maskOrder(doc, req.user?.role) });
  } catch (e) {
    console.error("patchAgentRef error:", e);
    res.status(500).json({ message: "Failed to update agentRef" });
  }
}
