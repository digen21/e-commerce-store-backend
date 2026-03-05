import { HydratedDocument, Types } from "mongoose";

export enum VariantSizes {
  XS = "XS",
  S = "S",
  M = "M",
  L = "L",
  XL = "XL",
  XXL = "XXL",
  "3XL" = "3XL",
  "4XL" = "4XL",
}

export interface IProductVariant {
  size: VariantSizes;
  stock: number;
  sku?: string;
  _id: string | Types.ObjectId;
}

export interface IProduct {
  _id: Types.ObjectId;
  title: string;
  description?: string;
  price: number;
  category?: string;
  stock: number;
  images: string[];
  isDeleted: boolean;
  deletedAt?: Date;
  expiresAt?: Date;
  createdAt: Date;
  sizes?: string[];
  variants?: IProductVariant[];
  updatedAt: Date;
}

export type IProductDoc = HydratedDocument<IProduct>;
