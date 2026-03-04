import mongoose, { PaginateModel, Query } from "mongoose";
import mongoosePaginate from "mongoose-paginate-v2";

import { IProduct } from "@types";

const ProductSchema = new mongoose.Schema<IProduct>(
  {
    title: { type: String, required: true },
    description: { type: String },
    price: { type: Number, required: true },
    category: { type: String, index: true },
    stock: { type: Number, required: true, min: 0 },
    images: { type: [String], default: [] },
    isDeleted: { type: Boolean, default: false },
    deletedAt: { type: Date },
    expiresAt: { type: Date, index: true },
  },
  { timestamps: true },
);

// Index for soft delete queries
ProductSchema.index({ isDeleted: 1 });

// TTL index - automatically delete documents after expiresAt
ProductSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
ProductSchema.index({ category: 1 });
ProductSchema.index({ title: "text" });
ProductSchema.index({ price: 1 });

// Default filter to exclude soft-deleted products
ProductSchema.pre(/^find/, async function (this: Query<IProduct[], IProduct>) {
  this.where({ isDeleted: false });
});

ProductSchema.plugin(mongoosePaginate);

export default mongoose.model<IProduct, PaginateModel<IProduct>>(
  "Product",
  ProductSchema,
  "products",
);
