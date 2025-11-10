// services/orders/normalize.js
import User from "../../models/User.js";

// derive lead name from rooms
function deriveLeadNameFromRooms(rooms = []) {
  for (const r of rooms || []) {
    for (const p of r?.pax || []) {
      const t = String(p?.type || "").toUpperCase();
      if (t === "ADT" || t === "ADULT" || t === "ADL") {
        const fn = p.firstName || p.firstname || p.given || "";
        const ln = p.lastName  || p.lastname  || p.surname || "";
        const name = [fn, ln].filter(Boolean).join(" ").trim();
        if (name) return name;
      }
    }
  }
  const p = rooms?.[0]?.pax?.[0];
  if (!p) return null;
  const fn = p.firstName || p.firstname || p.given || "";
  const ln = p.lastName  || p.lastname  || p.surname || "";
  return [fn, ln].filter(Boolean).join(" ").trim() || null;
}

function deriveRoomsCount(rooms = [], fallback = 1) {
  return Array.isArray(rooms) && rooms.length > 0 ? rooms.length : fallback;
}

async function ensureIdentity(o, reqUser) {
  const out = {
    userEmail: o?.userEmail ?? null,
    agencyName: o?.agencyName ?? null,
    userName: o?.summary?.userName ?? null,
  };

  // prefer fresh req.user snapshot from authMiddleware
  if (!out.userEmail && reqUser?.email) out.userEmail = reqUser.email;
  if (!out.agencyName && reqUser?.companyName) out.agencyName = reqUser.companyName;
  if (!out.userName && (reqUser?.firstName || reqUser?.lastName)) {
    out.userName = `${reqUser.firstName ?? ""} ${reqUser.lastName ?? ""}`.trim() || null;
  }

  // fallback: DB lookup by userId if still missing
  if ((!out.userEmail || !out.agencyName || !out.userName) && o?.userId) {
    const u = await User.findById(o.userId).select("email companyName firstName lastName").lean();
    if (u) {
      if (!out.userEmail && u.email) out.userEmail = u.email;
      if (!out.agencyName && u.companyName) out.agencyName = u.companyName;
      if (!out.userName && (u.firstName || u.lastName)) {
        out.userName = `${u.firstName ?? ""} ${u.lastName ?? ""}`.trim() || null;
      }
    }
  }

  return out;
}

/**
 * Main entry — returns { $set } for findOneAndUpdate or Object.assign for doc
 */
export async function ensureSummaryAndIdentity(orderLike, reqUser) {
  const identity = await ensureIdentity(orderLike, reqUser);

  const city = orderLike?.hotel?.cityName ?? orderLike?.details?.hotel?.city ?? null;
  const service = orderLike?.hotel?.name ?? orderLike?.details?.hotel?.name ?? null;

  const rooms = orderLike?.context?.roomsCount ?? deriveRoomsCount(orderLike?.rooms, 1);
  const leadName = orderLike?.summary?.leadName ?? deriveLeadNameFromRooms(orderLike?.rooms) ?? null;

  const refundable = orderLike?.cancellation?.refundable ?? orderLike?.summary?.cancellation?.refundable ?? null;
  const platformCutoffUtc = orderLike?.cancellation?.platformCutoffUtc ?? orderLike?.summary?.cancellation?.platformCutoffUtc ?? null;

  const amount = Number.isFinite(orderLike?.price?.amount) ? orderLike.price.amount : (orderLike?.summary?.price?.amount ?? 0);
  const currency = orderLike?.price?.currency || orderLike?.summary?.price?.currency || "USD";

  const arrivalDate = orderLike?.context?.arrivalDate ?? orderLike?.summary?.arrivalDate ?? null;
  const nights = Number.isFinite(orderLike?.context?.nights) ? orderLike.context.nights : (orderLike?.summary?.nights ?? null);

  const summary = {
    // Agent/User
    agentRef: orderLike?.agentRef ?? orderLike?.summary?.agentRef ?? "",
    agency: identity.agencyName ?? orderLike?.summary?.agency ?? null,
    userEmail: identity.userEmail ?? orderLike?.summary?.userEmail ?? null,
    userName: identity.userName ?? orderLike?.summary?.userName ?? null,

    // Display fields
    city,
    service,
    rooms,
    leadName,

    // Dates
    arrivalDate,
    nights,

    // Cancellation
    cancellation: {
      refundable,
      platformCutoffUtc,
    },

    // Pricing (selling = price)
    price: { amount, currency },
    sellingPrice: { amount, currency },

    // Paid (simple projection from payment)
    paid: ["authorized", "paid", "refunded", "captured", "settled"].includes(
      String(orderLike?.payment?.status || "").toLowerCase()
    ),
  };

  return { set: { ...identity, summary } };
}