const mongoose = require("mongoose");

const RoomSchema = new mongoose.Schema(
  {
    hotel: { type: mongoose.Schema.Types.ObjectId, ref: "Hotel", required: true },
    type: { type: String, required: true }, // e.g. "Double Room"
    description: { type: String, required: true },
    price: { type: Number, required: true },
    maxGuests: { type: Number, required: true },
    availableDates: [{ startDate: Date, endDate: Date }], // Հասանելի օրերը
  },
  { timestamps: true }
);

module.exports = mongoose.model("Room", RoomSchema);