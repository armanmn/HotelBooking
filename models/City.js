import mongoose from "mongoose";

const CitySchema = new mongoose.Schema(
  {
    // Քո արդեն շրջանառվող «քաղաքի կոդը» (օր. "563", "74") — պահում ենք որպես canonical code
    code: { type: String, required: true, unique: true },

    name: { type: String, required: true },                // "Paris"
    country: { type: String, required: true },             // "France"
    countryCode: { type: String },                         // "FR" (կամ թող դատարկ)
    lat: { type: Number },                                 // optional
    lng: { type: Number },                                 // optional
    aliases: [{ type: String }],                           // ["Paris", "Париж", ...] optional
    popularity: { type: Number, default: 0 },              // optional, ապագայում sort-ի համար
  },
  { timestamps: true }
);

CitySchema.index({ name: "text", country: "text", aliases: "text" });

export default mongoose.model("City", CitySchema);