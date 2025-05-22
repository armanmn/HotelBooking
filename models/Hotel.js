import mongoose from "mongoose";

const HotelSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    description: { type: String },
    location: {
      country: { type: String, required: true },
      city: { type: String, required: true },
      address: { type: String, required: true },
      coordinates: {
        lat: { type: Number, required: true },
        lng: { type: Number, required: true }
      }
    },
    images: [{ type: String }],
    facilities: [{ type: String }],
    popularFilters: [{ type: String }],
    rooms: [{ type: mongoose.Schema.Types.ObjectId, ref: "Room" }],

    owner: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    partnerType: {
      type: String,
      enum: ["direct", "external_api"],
      default: "direct"
    },
    externalSource: {
      provider: { type: String, default: null },
      hotelId: { type: String, default: null },
      dataSyncStatus: {
        type: String,
        enum: ["synced", "pending", "failed"],
        default: "pending"
      },
      lastSyncedAt: { type: Date }
    },
    isApproved: { type: Boolean, default: false },
    requiredNationality: { type: Boolean, default: false },
    isVisible: { type: Boolean, default: true },
    rating: { type: Number, default: 0 },
    reviewsCount: { type: Number, default: 0 }
  },
  { timestamps: true }
);

const Hotel = mongoose.model("Hotel", HotelSchema);
export default Hotel;