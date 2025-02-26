import mongoose from "mongoose";

const FinanceSchema = new mongoose.Schema(
  {
    transactionType: {
      type: String,
      enum: ["incoming", "outgoing"], // ✅ "incoming" - Մուտք, "outgoing" - Ելք
      required: true
    },
    referenceId: {
      type: mongoose.Schema.Types.ObjectId,
      refPath: "referenceModel",
      required: true
    },
    referenceModel: {
      type: String,
      enum: ["Payment", "Booking"], // ✅ Կարող է կապված լինել Payment կամ Booking-ի հետ
      required: true
    },
    amount: {
      type: Number,
      required: true
    },
    currency: {
      type: String,
      enum: ["AMD", "USD", "EUR", "RUB"],
      required: true
    },
    exchangeRate: {
      type: Number,
      required: true
    },
    convertedAmountAMD: {
      type: Number,
      required: true
    },
    processedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true
    },
    processedAt: {
      type: Date,
      default: Date.now
    },
    note: {
      type: String
    }
  },
  { timestamps: true }
);

const Finance = mongoose.model("Finance", FinanceSchema);
export default Finance;