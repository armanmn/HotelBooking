import mongoose from "mongoose";
import { subDays } from "date-fns"; // Օրերի նվազեցման համար

const RoomSchema = new mongoose.Schema(
  {
    hotel: { type: mongoose.Schema.Types.ObjectId, ref: "Hotel", required: true },
    type: { type: String, required: true },
    price: { type: Number, required: true },
    maxOccupancy: { type: Number, required: true },
    description: { type: String },
    amenities: { type: [String] },
    isRefundable: { type: Boolean, default: true },
    refundableUntil: { type: Date, default: null },
    availability: { type: Number, default: 0 },
    externalRoomId: { type: String, default: null },
    status: {
      type: String,
      enum: ["active", "inactive", "unavailable"],
      default: "active"
    },

    // ✅ Availability per date (for Channel Managers or calendar-based control)
    roomInventory: [
      {
        date: { type: Date, required: true },
        availableRooms: { type: Number, required: true },

        // ✅ Restrictions per date
        restrictions: {
          minStay: { type: Number, default: 1 },
          maxStay: { type: Number, default: 30 },
          closed: { type: Boolean, default: false },
          noCheckIn: { type: Boolean, default: false },
          noCheckOut: { type: Boolean, default: false }
        }
      }
    ]
  },
  { timestamps: true }
);

RoomSchema.pre("save", function (next) {
  if (this.isRefundable && this.refundableUntil) {
    this.refundableUntil = subDays(this.refundableUntil, 2);
  }
  if (this.refundableUntil && this.refundableUntil <= new Date()) {
    this.isRefundable = false;
  }
  next();
});

const Room = mongoose.model("Room", RoomSchema);
export default Room;