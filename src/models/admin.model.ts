import mongoose, { PaginateModel } from "mongoose";
import mongoosePaginate from "mongoose-paginate-v2";

import { IAdminProfile } from "@types";

const AdminAddressSchema = new mongoose.Schema(
  {
    addressLine1: { type: String, required: true },
    addressLine2: { type: String },
    city: { type: String, required: true },
    state: { type: String, required: true },
    postalCode: { type: String, required: true },
    country: { type: String, required: true },
  },
  { _id: false },
);

const AdminProfileSchema = new mongoose.Schema<IAdminProfile>(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    storeName: { type: String, required: true, trim: true },
    email: { type: String, required: true, lowercase: true, trim: true },
    phone: { type: String, required: true, trim: true },
    gstn: { type: String, trim: true },
    currency: { type: String, default: "INR", uppercase: true },
    address: { type: AdminAddressSchema, required: true },
    taxRate: { type: Number, default: 0, min: 0, max: 100 },
    lowStockThreshold: { type: Number, default: 10, min: 0 },
  },
  { timestamps: true },
);

// Indexes for efficient queries
AdminProfileSchema.index({ user: 1 });
AdminProfileSchema.index({ email: 1 });
AdminProfileSchema.index({ storeName: 1 });

AdminProfileSchema.plugin(mongoosePaginate);

export default mongoose.model<IAdminProfile, PaginateModel<IAdminProfile>>(
  "AdminProfile",
  AdminProfileSchema,
  "admin_profiles",
);
