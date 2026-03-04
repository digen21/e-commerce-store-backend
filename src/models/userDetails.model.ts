import mongoose, { PaginateModel } from "mongoose";
import mongoosePaginate from "mongoose-paginate-v2";

import { IUserDetails } from "@types";

const AddressSchema = new mongoose.Schema({
  fullName: { type: String, required: true },
  phone: { type: String, required: true },
  addressLine1: { type: String, required: true },
  addressLine2: String,
  city: { type: String, required: true },
  state: { type: String, required: true },
  postalCode: { type: String, required: true },
  country: { type: String, default: "India" },
});

const UserDetailsSchema = new mongoose.Schema<IUserDetails>(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      unique: true,
      required: true,
    },

    addresses: {
      type: [AddressSchema],
    },

    // bg process
    stats: {
      totalOrders: { type: Number, default: 0 },
      totalSpent: { type: Number, default: 0 },
    },
  },
  { timestamps: true },
);

UserDetailsSchema.plugin(mongoosePaginate);
export default mongoose.model<IUserDetails, PaginateModel<IUserDetails>>(
  "UserDetails",
  UserDetailsSchema,
  "userDetails",
);
