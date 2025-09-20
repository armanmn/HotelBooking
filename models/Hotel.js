import mongoose from "mongoose";

const HotelSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    description: {
      en: { type: String },
      hy: { type: String },
      ru: { type: String },
    },
    location: {
      country: { type: String, required: true },
      city: { type: String, required: true },
      address: { type: String, required: true },
      coordinates: {
        lat: { type: Number, required: true },
        lng: { type: Number, required: true },
      },
    },
    thumbnail: { type: String },
    images: [
      {
        url: { type: String, required: true },
        isMain: { type: Boolean, default: false },
      },
    ],
    stars: {
      type: Number,
      min: 1,
      max: 5,
      default: 3,
    },
    facilities: [{ type: String }],
    popularFilters: [{ type: String }],

    owner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    partnerType: {
      type: String,
      enum: ["direct", "external_api"],
      default: "direct",
    },

    // External source details (multi-supplier support)
    externalSource: {
      provider: {
        type: String,
        enum: ["inlobby", "goglobal", "hotelbeds", "stuba"],
        required: true,
      },
      providerHotelId: { type: String }, // HotelCode in GoGlobal, code in HotelBeds
      cityId: { type: String }, // GoGlobal cityId / HotelBeds destination code
      destinationCode: { type: String }, // For HotelBeds or similar APIs
      lastSyncedAt: Date,
    },

    // Hotel meta
    isApproved: { type: Boolean, default: false },
    isVisible: { type: Boolean, default: true },
    rating: { type: Number, default: 0 },
    reviewsCount: { type: Number, default: 0 },
    externalRating: {
      score: { type: Number, min: 0, max: 10 },
    },

    // Optimization: minimum price for hotel (cheapest offer)
   minPrice: {
      amount: { type: Number, default: 0, min: 0 },
      currency: {
        type: String,
        uppercase: true,
        validate: {
          validator: function (v) {
            // եթե գին կա, currency պարտադիր է և պետք է լինի ISO 4217՝ 3 մեծատառ
            if (this.minPrice?.amount > 0) {
              return /^[A-Z]{3}$/.test(v || "");
            }
            // եթե գին չկա (0), currency-ը չպետք է լինի (թող undefined)
            return v == null;
          },
          message:
            "minPrice.currency must be a 3-letter code when amount > 0; omit it when amount is 0.",
        },
      },
      lastUpdated: { type: Date },
    },
  },
  { timestamps: true }
);

const Hotel = mongoose.model("Hotel", HotelSchema);
export default Hotel;