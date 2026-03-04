import { HydratedDocument, Types } from "mongoose";

export interface IToken {
  user: Types.ObjectId | string;
  token: string;
  type: string;
  expiresAt?: Date;
  _id: Types.ObjectId;
  createdAt?: string;
  updatedAt?: string;
  isDeleted: boolean;
  deletedAt?: Date;
}

export type ITokenDoc = HydratedDocument<IToken>;
