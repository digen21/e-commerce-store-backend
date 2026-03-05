import { HydratedDocument, Types } from "mongoose";

export type ExtendedRequest = Request & {
  user: IUser;
};

export enum UserRoles {
  ADMIN = "ADMIN",
  USER = "USER",
}

export interface IUser {
  _id: Types.ObjectId | string;
  name: string;
  email: string;
  password: string;
  role: UserRoles;
  createdAt: Date;
  updatedAt: Date;
  verifiedAt: Date;
  isVerified: boolean;
}

export type UserWithOutPassword = Omit<IUser, "password">;

export interface IAddress {
  _id: Types.ObjectId | string;
  fullName: string;
  phone: string;
  addressLine1: string;
  addressLine2?: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
}

export interface IUserStats {
  totalOrders: number;
  totalSpent: number;
}

export interface IUserDetails {
  _id: Types.ObjectId | string;
  user: Types.ObjectId | string;
  addresses: IAddress[];
  stats: IUserStats;
  createdAt: Date;
  updatedAt: Date;
}

export type IUserDoc = HydratedDocument<IUser>;
export type IUserDetailsDoc = HydratedDocument<IUserDetails>;
export type IUserStatsDoc = HydratedDocument<IUserStats>;
export type IAddressDoc = HydratedDocument<IAddress>;
