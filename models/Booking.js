import mongoose from "mongoose";

const BookingSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    room: {
      type: new mongoose.Schema(
        {
          roomId: { type: mongoose.Schema.Types.ObjectId, ref: "Room" },
          type: String,
          description: String,
          price: Number,
          maxOccupancy: Number,
          amenities: [String],
        },
        { _id: false }
      ),
    },

    hotel: {
      type: new mongoose.Schema(
        {
          hotelId: { type: mongoose.Schema.Types.ObjectId, ref: "Hotel" },
          name: String,
          location: {
            country: String,
            city: String,
            address: String,
          },
          image: String,
        },
        { _id: false }
      ),
    },

    guest: {
      leadGuest: {
        firstName: String,
        lastName: String,
        email: String,
        phone: String,
        address: String,
        country: String,
        countryCode: String,
      },
      companions: [
        {
          firstName: String,
          lastName: String,
          age: Number,
          type: {
            type: String,
            enum: ["adult", "child"],
            default: "adult",
          },
        },
      ],
      receiveOffers: Boolean,
    },

    checkInDate: { type: Date, required: true },
    checkOutDate: { type: Date, required: true },
    nights: { type: Number, required: true },
    totalPrice: { type: Number, required: true },

    paymentMethod: {
      type: String,
      enum: ["pay_later", "credit_card", "balance"],
      required: true,
    },
    paymentStatus: {
      type: String,
      enum: ["not_paid", "paid_pending_verification", "verified", "refunded"],
      default: "not_paid",
    },

    bookingStatus: {
      type: String,
      enum: [
        "waiting_approval",
        "confirmed",
        "cancelled",
        "rejected_by_partner",
      ],
      default: "waiting_approval",
    },

    orderStatus: {
      type: String,
      enum: [
        "awaiting_payment",
        "awaiting_confirmation",
        "confirmed",
        "cancelled_by_user",
        "cancelled_due_to_no_payment",
        "refunded",
        "rejected",
      ],
      default: "awaiting_payment",
    },
  },
  { timestamps: true }
);

const Booking =
  mongoose.models.Booking || mongoose.model("Booking", BookingSchema);
export default Booking;
