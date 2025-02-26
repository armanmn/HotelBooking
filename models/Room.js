import mongoose from "mongoose";
import { subDays } from "date-fns"; // Օրերի նվազեցման համար

const RoomSchema = new mongoose.Schema(
  {
    hotel: { type: mongoose.Schema.Types.ObjectId, ref: "Hotel", required: true },
    type: { type: String, required: true }, // Օրինակ՝ "Double Room", "Suite"
    price: { type: Number, required: true },
    maxOccupancy: { type: Number, required: true },
    description: { type: String },
    amenities: { type: [String] }, // Օրինակ՝ ["WiFi", "Air Conditioning", "Pool"]
    isRefundable: { type: Boolean, default: true }, // ✅ Եթե false է, նշանակում է non-refundable
    refundableUntil: { type: Date, default: null }, // ✅ Ավտոմատ կլինի հյուրանոցի սահմանած refundableUntil - 2 օր
    availability: { type: Number, default: 0 }, // Հասանելի սենյակների քանակ
  },
  { timestamps: true }
);

// ✅ Հաշվում ենք refundableUntil-ը՝ հաշվի առնելով 2 օրվա նվազեցումը
RoomSchema.pre("save", function (next) {
  if (this.isRefundable && this.refundableUntil) {
    this.refundableUntil = subDays(this.refundableUntil, 2);
  }

  // Եթե refundableUntil-ը <= 2 օրից, այն դարձնում ենք non-refundable
  if (this.refundableUntil && this.refundableUntil <= new Date()) {
    this.isRefundable = false;
  }

  next();
});

const Room = mongoose.model("Room", RoomSchema);
export default Room;