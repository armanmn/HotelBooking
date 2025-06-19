import mongoose from "mongoose";

const RoomSchema = new mongoose.Schema(
  {
    hotel: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Hotel",
      required: true,
    },
    baseType: { type: String, required: true }, // e.g. Standard Double
    maxOccupancy: { type: Number, required: true },
    beds: { type: Number },
    size: { type: String }, // e.g. 25 sqm
    amenities: [{ type: String }],
    description: { type: String },

    status: {
      type: String,
      enum: ["active", "inactive", "unavailable"],
      default: "active",
    },

    // ✅ Սենյակի տարբերակներ՝ ըստ view, meal plan, cancellation policy
    variants: [
      {
        view: {
          type: String,
          enum: ["city", "garden", "sea", "mountain", "pool", "other"],
          default: "city",
        },
        mealPlan: {
          type: String,
          enum: [
            "room_only",
            "breakfast",
            "half_board",
            "full_board",
            "all_inclusive",
            "ultra_all_inclusive",
          ],
          default: "room_only",
        },
        cancellationPolicy: {
          type: String,
          enum: ["refundable", "nonrefundable"],
          default: "nonrefundable",
        },
        refundableDaysBeforeCheckIn: { type: Number, default: 0 }, // e.g. 3 օր առաջ
        refundableExactDate: { type: Date, default: null }, // եթե integrator-ը տալիս է հաստատ օրով
        price: { type: Number, required: true },
      },
    ],

    images: [
      {
        url: { type: String, required: true },
        isMain: { type: Boolean, default: false },
      },
    ],

    externalRoomId: { type: String, default: null },
    availability: { type: Number, default: 0 },

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
          noCheckOut: { type: Boolean, default: false },
        },
      },
    ],
  },
  { timestamps: true }
);

const Room = mongoose.model("Room", RoomSchema);
export default Room;