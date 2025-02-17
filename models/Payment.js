const mongoose = require("mongoose");

const PaymentSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    booking: { type: mongoose.Schema.Types.ObjectId, ref: "Booking", required: true },
    amount: { type: Number, required: true },
    paymentMethod: { type: String, enum: ["Card", "Bank Transfer"], required: true },
    status: { type: String, enum: ["Pending", "Completed", "Failed"], default: "Pending" },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Payment", PaymentSchema);