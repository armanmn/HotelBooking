const mongoose = require("mongoose");

const BookingSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    hotel: { type: mongoose.Schema.Types.ObjectId, ref: "Hotel", required: true },
    room: { type: mongoose.Schema.Types.ObjectId, ref: "Room", required: true },
    checkIn: { type: Date, required: true },
    checkOut: { type: Date, required: true },
    guests: { adults: Number, children: Number },
    totalPrice: { type: Number, required: true },
    status: { type: String, enum: ["Pending", "Confirmed", "Cancelled"], default: "Pending" },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Booking", BookingSchema);