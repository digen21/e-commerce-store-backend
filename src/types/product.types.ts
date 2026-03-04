import { HydratedDocument, Types } from "mongoose";

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
  updatedAt: Date;
}

export type IProductDoc = HydratedDocument<IProduct>;
