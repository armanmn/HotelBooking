import mongoose from "mongoose";

const SupplierCityMapSchema = new mongoose.Schema(
  {
    supplier: { type: String, required: true },      // 'goglobal', 'hotelbeds', ...
    supplierCityId: { type: String, required: true },// օրինակ՝ "563"
    cityCode: { type: String, required: true },      // canonical code, օրինակ՝ "563"
    supplierCityName: { type: String },              // optional, debug/help
    active: { type: Boolean, default: true },
    lastVerifiedAt: { type: Date },
  },
  { timestamps: true }
);

SupplierCityMapSchema.index({ supplier: 1, supplierCityId: 1 }, { unique: true });
SupplierCityMapSchema.index({ cityCode: 1 });

export default mongoose.model("SupplierCityMap", SupplierCityMapSchema);