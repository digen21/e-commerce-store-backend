import { HydratedDocument, Types } from "mongoose";

export interface IAdminAddress {
  addressLine1: string;
  addressLine2?: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
}

export interface IAdminProfile {
  _id: Types.ObjectId;
  user: Types.ObjectId;
  storeName: string;
  email: string;
  phone: string;
  gstn?: string;
  currency: string;
  address: IAdminAddress;
  taxRate: number;
  lowStockThreshold: number;
  createdAt: Date;
  updatedAt: Date;
}

export type IAdminProfileDoc = HydratedDocument<IAdminProfile>;
