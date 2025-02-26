import mongoose from "mongoose";

const UserSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    role: {
      type: String,
      enum: ["b2c", "b2b_hotel_partner", "b2b_sales_partner", "office_user", "finance_user", "admin"],
      default: "b2c"
    },
    hotelPartnerId: { type: mongoose.Schema.Types.ObjectId, ref: "HotelPartner", default: null }, // ✅ Միայն Hotel Partners-ի համար
    markupPercentage: { type: Number, default: 0 }, // ✅ Sales Partners-ի համար
  },
  { timestamps: true }
);

const User = mongoose.model("User", UserSchema);

// ✅ Ճիշտ տարբերակը՝ default export
export default User;