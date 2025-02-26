import mongoose from "mongoose";

const HotelSchema = new mongoose.Schema(
  {
    name: { type: String, required: true }, // ✅ Հյուրանոցի անունը
    description: { type: String }, // ✅ Հյուրանոցի նկարագրություն
    location: {
      country: { type: String, required: true }, // ✅ Երկիր
      city: { type: String, required: true }, // ✅ Քաղաք
      address: { type: String, required: true }, // ✅ Հասցե
      coordinates: {
        lat: { type: Number, required: true }, // ✅ Լայնություն (Latitude)
        lng: { type: Number, required: true }  // ✅ Երկայնություն (Longitude)
      }
    },
    images: [{ type: String }], // ✅ Հյուրանոցի նկարներ (URL-ներ)
    facilities: [{ type: String }], // ✅ Հյուրանոցի հիմնական հարմարությունները (WiFi, Pool, Spa, etc.)
    popularFilters: [{ type: String }], // ✅ Ընդհանուր ֆիլտրեր (Near Center, Breakfast Included, etc.)
    rooms: [{ type: mongoose.Schema.Types.ObjectId, ref: "Room" }], // ✅ Հյուրանոցի սենյակների ID-ները

    // ✅ Տեղեկություն սեփականատիրոջ (B2B Hotel Partner) մասին
    owner: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },

    // ✅ Տարբերակում, թե հյուրանոցը որտեղից է ավելացվել
    partnerType: {
      type: String,
      enum: ["direct", "external_api"], // "direct" - սեփականատեր է ավելացրել, "external_api" - ինտեգրված է
      default: "direct"
    },

    // ✅ Եթե հյուրանոցը ստացվել է API ինտեգրման միջոցով, այս դաշտերը կպահպանվեն
    externalSource: {
      provider: { type: String, default: null }, // API մատակարարի անունը (օր.՝ "Expedia", "Booking.com")
      hotelId: { type: String, default: null } // API մատակարարի ID
    },

    // ✅ Admin-ի հաստատման կարգավիճակ
    isApproved: { type: Boolean, default: false },

    // ✅ Ազգության պահանջ՝ որոշ հյուրանոցներ պահանջում են ազգությունը
    requiredNationality: { type: Boolean, default: false }, // true դեպքում nationality դաշտը պարտադիր կլինի Booking-ի համար
  },
  { timestamps: true }
);

const Hotel = mongoose.model("Hotel", HotelSchema);
export default Hotel;