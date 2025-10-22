// controllers/hotelOrdersController.js

import HotelOrder from "../models/HotelOrder.js";
import { isOps } from "../utils/acl.js";
import {
  deriveLeadName,
  deriveRoomsCount,
  derivePaid,
} from "../services/orders/derivers.js";

import {
  isSupplierStatusCode,
  labelPlatformStatus,
  normalizePlatformStatusInput, // 🔹 NEW
} from "../services/orders/status.js";

/** sanitize order output for a given role */
function maskOrder(orderDoc, role) {
  const o = orderDoc.toObject ? orderDoc.toObject() : orderDoc;

  const summary = {
    platformRef: o.platformRef,
    agentRef: o.agentRef || "",
    agency: o.agencyName || null,
    user: o.userEmail || null,

    status: o.status, // stored code (C/RQ/…)
    statusLabel: labelPlatformStatus(o.status), // nice label

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
      currency: o.price?.currency || "USD",
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
    const {
      mine,
      status, // platform status (can be code or full name)
      rawStatus, // explicit supplier raw
      from,
      to,
      city,
      service,
      platformRef,
      q,
      page = 1,
      limit = 20,
    } = req.query;

    const role = req.user?.role;
    const qdb = {};

    if (!isOps(role) || String(mine) === "1") {
      qdb.userId = req.user?._id || req.user?.id;
    }

    // 🔹 Status filters
    if (status) {
      const s = String(status).trim();
      if (isSupplierStatusCode(s)) {
        qdb["supplier.rawStatus"] = s.toUpperCase();
      } else {
        const norm = normalizePlatformStatusInput(s);
        if (!norm) {
          return res.status(400).json({ message: "Invalid status filter" });
        }
        qdb.status = norm; // stored as C/RQ/RJ/RX/X/PENDING/FAILED
      }
    }
    if (rawStatus) {
      qdb["supplier.rawStatus"] = String(rawStatus).toUpperCase();
    }

    if (platformRef) qdb.platformRef = String(platformRef);

    if (from || to) {
      qdb["context.arrivalDate"] = {};
      if (from) qdb["context.arrivalDate"].$gte = String(from);
      if (to) qdb["context.arrivalDate"].$lte = String(to);
    }

    if (q) {
      const re = new RegExp(
        String(q).replace(/[.*+?^${}()|[\]\\]/g, "\\$&"),
        "i"
      );
      qdb.$or = [
        { platformRef: re },
        { agentRef: re },
        { userEmail: re },
        { "hotel.name": re },
        { "hotel.cityName": re },
      ];
    } else {
      if (city) qdb["hotel.cityName"] = new RegExp(String(city), "i");
      if (service) qdb["hotel.name"] = new RegExp(String(service), "i");
    }

    const skip = (Math.max(1, Number(page)) - 1) * Math.max(1, Number(limit));
    const docs = await HotelOrder.find(qdb)
      .sort({ createdAt: -1, _id: -1 })
      .skip(skip)
      .limit(Math.max(1, Number(limit)));

    const out = docs.map((d) => maskOrder(d, role));
    res.json({ items: out, page: Number(page), limit: Number(limit) });
  } catch (e) {
    console.error("listHotelOrders error:", e);
    res.status(500).json({ message: "Failed to list orders" });
  }
}

// export async function getHotelOrder(req, res) {
//   try {
//     const { platformRef } = req.params;
//     if (!platformRef)
//       return res.status(400).json({ message: "platformRef is required" });

//     const baseQuery = { platformRef };
//     if (!isOps(req.user?.role)) {
//       baseQuery.userId = req.user?._id || req.user?.id;
//     }

//     const doc = await HotelOrder.findOne(baseQuery);
//     if (!doc) return res.status(404).json({ message: "Order not found" });

//     const o = doc.toObject();
//     o.statusLabel = labelPlatformStatus(o.status); // friendly label
//     if (!isOps(req.user?.role)) delete o.supplier;

//     res.json({ order: o });
//   } catch (e) {
//     console.error("getHotelOrder error:", e);
//     res.status(500).json({ message: "Failed to load order" });
//   }
// }

export async function getHotelOrder(req, res) {
  try {
    const { platformRef } = req.params;
    if (!platformRef) {
      return res.status(400).json({ message: "platformRef is required" });
    }

    const role = req.user?.role;
    const baseQuery = { platformRef };

    // ոչ-ops օգտատերերը տեսնում են միայն իրենցը
    if (!isOps(role)) baseQuery.userId = req.user._id;

    const doc = await HotelOrder.findOne(baseQuery);
    if (!doc) return res.status(404).json({ message: "Order not found" });

    const o = doc.toObject();

    // ------- summary (նույն կառուցվածքը, ինչ list-ում) -------
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
      // list-ում price==sellingPrice էր. details-ում պահում ենք երկուսը (retail/net՝ ներքևում)
      price: {
        amount: o.price?.amount ?? 0,
        currency: o.price?.currency || "USD",
      },
      sellingPrice: {
        amount: o.price?.amount ?? 0,
        currency: o.price?.currency || "USD",
      },
      paid: derivePaid(o.payment),
    };

    // ------- hotel mini + details -------
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
      rooms: (o.rooms || []).map(r => ({
        roomId: r.roomId,
        category: r.category || null,
        pax: (r.pax || []).map(p => ({
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
        retail: { amount: o.price?.amount ?? 0, currency: o.price?.currency || "USD" },
        // ops-ի համար ցույց տանք նաև net-ը, մյուսների համար թող լինի null
        net: isOps(role)
          ? { amount: o?.supplierNet?.amount ?? null, currency: o?.supplierNet?.currency ?? null }
          : { amount: null, currency: null },
      },
    };

    // ------- payment -------
    const payment = o.payment || {
      status: "unpaid",
      method: null,
      provider: null,
      history: [],
    };

    // ------- assemble normalized order -------
    const order = {
      platformRef: o.platformRef,
      status: o.status,
      statusLabel: labelPlatformStatus(o.status),
      role: o.role || role || null,
      summary,
      details,
      payment,
    };

    // ops only: supplier block + raw
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
    if (!isOps(req.user?.role)) baseQuery.userId = req.user._id;

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
