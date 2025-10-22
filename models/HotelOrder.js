// New
// server/src/models/HotelOrder.js
import mongoose from "mongoose";
const { Schema } = mongoose;

// ─────────────────────────────────────────────────────────────
// Sub-schemas
// ─────────────────────────────────────────────────────────────
const PaxSchema = new Schema(
  {
    type: { type: String, enum: ["ADT", "CHD"], required: true },
    title: {
      type: String,
      enum: ["MR.", "MRS.", "MISS", "MS", "CHD", null],
      default: null,
    },
    firstName: { type: String, required: true },
    lastName: { type: String, required: true },
    age: { type: Number, min: 0, max: 17 }, // only for CHD
  },
  { _id: false }
);

const RoomSchema = new Schema(
  {
    roomId: { type: Number, default: 1 },
    pax: [PaxSchema],
  },
  { _id: false }
);

const PaymentHistorySchema = new Schema(
  {
    at: { type: Date, default: Date.now },
    status: {
      type: String,
      enum: ["unpaid", "authorized", "paid", "refunded", "failed"],
    },
    method: {
      type: String,
      enum: ["none", "arca", "deposit", "manual"],
      default: "none",
    },
    payload: { type: Schema.Types.Mixed },
  },
  { _id: false }
);

// ─────────────────────────────────────────────────────────────
// Main schema
// ─────────────────────────────────────────────────────────────
const HotelOrderSchema = new Schema(
  {
    // Public/platform id — FIRST SAVE-ով թողնում ենք null, հետո controller-ում գեներացնում ենք
    platformRef: { type: String, required: false, default: null },

    // Type (future-proof, եթե հետո ունենանք avia/car)
    type: { type: String, enum: ["hotel"], default: "hotel", index: true },

    // Who
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: false,
      index: true,
    },
    role: {
      type: String,
      enum: ["b2c", "b2b_sales_partner", "office_user", "finance", "admin"],
      required: true,
    },
    userEmail: { type: String, index: true },
    agencyName: { type: String, default: null }, // for b2b_sales_partner mostly
    agentRef: { type: String, default: "" }, // user-entered internal ref

    // Order status (supplier-like codes)
    status: {
      type: String,
      enum: ["C", "RQ", "RJ", "RX", "X", "PENDING", "FAILED"],
      required: true,
      index: true,
    },

    // Supplier (ops-only, office/finance/admin visibility FE-ում)
    supplier: {
      code: { type: String, default: "goglobal" },
      name: { type: String, default: "Go Global" },
      bookingCode: { type: String, default: null }, // goBookingCode
      reference: { type: String, default: null }, // goReference
      rawStatus: { type: String, default: null }, // e.g. C/RJ/RQ
    },

    // Quick hotel denorm (optional, summary-level)
    hotel: {
      id: { type: String, default: null },
      name: { type: String, default: null },
      cityName: { type: String, default: null },
      countryName: { type: String, default: null },
    },

    // Search/booking context
    context: {
      arrivalDate: { type: String }, // "YYYY-MM-DD"
      nights: { type: Number, default: 1 },
      roomsCount: { type: Number, default: 1 },
      roomBasis: { type: String, default: null },
      hotelSearchCode: { type: String, default: null },
    },

    // (Optional) top-level price (եթե պետք գա արագ ցուցադրել)
    price: {
      amount: { type: Number, default: 0 },
      currency: { type: String, default: "USD" },
      markupPct: { type: Number, default: 0 },
    },

    // (Optional) top-level cancellation (քո հին կառուցվածքը պահպանել եմ)
    cancellation: {
      refundable: { type: Boolean, default: null },
      platformCutoffUtc: { type: String, default: null },
    },

    // Pax at top-level (optional — details.rooms-ում էլ ունենք լրիվ state)
    rooms: [RoomSchema],

    // Remarks
    supplierRemarksHtml: { type: String, default: null },
    clientRemark: { type: String, default: "" },

    // Payment (platform-level)
    payment: {
      status: {
        type: String,
        enum: ["unpaid", "authorized", "paid", "refunded", "failed"],
        default: "unpaid",
      },
      method: {
        type: String,
        enum: ["none", "arca", "deposit", "manual"],
        default: "none",
      },
      history: [PaymentHistorySchema],
    },

    // ✨ Summary — սա է օգտագործվում list view-ում
    summary: {
      agentRef: { type: String, default: "" },
      agency: { type: String, default: null },
      userEmail: { type: String, default: null },
      city: { type: String, default: null },
      service: { type: String, default: null },
      rooms: { type: Number, default: 1 },
      leadName: { type: String, default: null },
      arrivalDate: { type: String, default: null },
      nights: { type: Number, default: null },
      cancellation: {
        refundable: { type: Boolean, default: null },
        platformCutoffUtc: { type: String, default: null },
      },
      price: {
        amount: { type: Number, default: 0 },
        currency: { type: String, default: "USD" },
      },
      sellingPrice: {
        amount: { type: Number, default: 0 },
        currency: { type: String, default: "USD" },
      },
      paid: { type: Boolean, default: false },
    },

    // ✨ Details — ամբողջական snapshot, որը ցույց կտաս details էջում
    details: {
      hotel: {
        id: { type: String, default: null },
        name: { type: String, default: null },
        category: { type: Schema.Types.Mixed, default: null }, // stars/category
        address: { type: String, default: null },
        city: { type: String, default: null },
        country: { type: String, default: null },
        image: { type: String, default: null },
      },
      context: {
        hotelSearchCode: { type: String, default: null },
        arrivalDate: { type: String, default: null },
        nights: { type: Number, default: null },
        roomBasis: { type: String, default: null },
      },
      rooms: [RoomSchema],
      cancellation: {
        supplier: {
          refundable: { type: Boolean, default: null },
          deadlineUtc: { type: String, default: null },
        },
        platform: {
          refundable: { type: Boolean, default: null },
          cutoffUtc: { type: String, default: null },
          bufferDays: { type: Number, default: null },
          reason: { type: String, default: null },
        },
        hoursUntilSupplierDeadline: { type: Number, default: null },
        refundable: { type: Boolean, default: null },
        supplierDeadlineUtc: { type: String, default: null },
        platformCutoffUtc: { type: String, default: null },
        safeToBook: { type: Boolean, default: null },
        bufferDays: { type: Number, default: null },
      },
      remarksHtml: { type: String, default: null },
      price: {
        retail: {
          amount: { type: Number, default: 0 },
          currency: { type: String, default: "USD" },
        },
        net: {
          amount: { type: Number, default: 0 },
          currency: { type: String, default: "USD" },
        },
      },
    },
  },
  { timestamps: true }
);

// ─────────────────────────────────────────────────────────────
// Indexes
// ─────────────────────────────────────────────────────────────
HotelOrderSchema.index({ userId: 1, status: 1, "context.arrivalDate": 1 });
HotelOrderSchema.index({ "supplier.bookingCode": 1 });
HotelOrderSchema.index({ platformRef: 1 }, { unique: true });

// ─────────────────────────────────────────────────────────────
// Export
// ─────────────────────────────────────────────────────────────
export default mongoose.models.HotelOrder ||
  mongoose.model("HotelOrder", HotelOrderSchema);
