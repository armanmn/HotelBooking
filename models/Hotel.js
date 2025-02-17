const mongoose = require("mongoose");

const HotelSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    location: { type: String, required: true },
    description: { type: String },
    stars: { type: Number, min: 1, max: 5, required: true },
    rooms: [{ type: mongoose.Schema.Types.ObjectId, ref: "Room" }],
    amenities: [String],
    partnerAPI: { type: String, default: null }, // Եթե հյուրանոցը գալիս է գործընկերոջ API-ից
  },
  { timestamps: true }
);

module.exports = mongoose.model("Hotel", HotelSchema);