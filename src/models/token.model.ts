import { PaginateModel, Schema, model } from "mongoose";

import { IToken } from "@types";

const tokenSchema = new Schema<IToken>(
  {
    user: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    token: {
      type: "string",
      trim: true,
      required: true,
    },
    type: {
      type: "string", //verification mail, order confirmation mail
      trim: true,
      required: true,
    },
    expiresAt: {
      type: Date,
      required: true,
      index: true,
    },
    deletedAt: {
      type: Date,
    },
  },
  { timestamps: true },
);

const Token = model<IToken, PaginateModel<IToken>>(
  "Token",
  tokenSchema,
  "tokens",
);
export default Token;
