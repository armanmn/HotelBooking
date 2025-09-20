import mongoose from "mongoose";

const offerSchema = new mongoose.Schema(
  {
    hotel: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Hotel",
      required: true,
    },

    provider: {
      type: String,
      enum: ["inlobby", "goglobal", "hotelbeds"],
      required: true,
    },

    // Գլխավոր unique բանալին՝ GoGlobal-ի իսկական rate key
    externalOfferId: {
      type: String,
      required: true,
      index: true, // արագ որոնման համար
    },

    roomType: { type: String, required: true },
    boardType: { type: String },

    guests: {
      adults: { type: Number, default: 2 },
      children: { type: Number, default: 0 },
      maxOccupancy: { type: Number },
    },

    availability: { type: Number, default: 0 },

    price: {
      amount: { type: Number, required: true, min: 0 },
      currency: {
        type: String,
        uppercase: true,
        required: function () {
          return (this.price?.amount ?? 0) > 0;
        },
        match: /^[A-Z]{3}$/,
      },
      baseCurrency: { type: String, uppercase: true }, // թողնենք optional, առանց default
      originalAmount: Number,
      lastUpdated: { type: Date, default: Date.now },
    },

    cancellationPolicy: {
      refundable: { type: Boolean, default: true },
      nonRefundableReason: { type: String },
      deadline: { type: Date },
      penaltyAmount: Number,
      notes: String,
    },

    rateDetails: {
      rateType: { type: String },
      discount: {
        type: { type: String, enum: ["percent", "amount"] },
        value: Number,
      },
      specialConditions: String,
    },

    hotelStars: { type: Number },
    isCheapest: { type: Boolean, default: false },

    sync: {
      providerHotelId: String,
      providerRoomId: String,
      lastSyncedAt: Date,
    },
  },
  { timestamps: true }
);

const Offer = mongoose.model("Offer", offerSchema);
export default Offer;