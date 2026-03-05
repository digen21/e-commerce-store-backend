import mongoose, { PaginateModel } from "mongoose";
import mongoosePaginate from "mongoose-paginate-v2";

import { IPayment } from "@types";
import {
  PaymentMethod,
  PaymentStatus,
  RefundStatus,
} from "../types/payment.types";

const PaymentItemSchema = new mongoose.Schema(
  {
    productId: { type: mongoose.Schema.Types.ObjectId, ref: "Product" },
    productName: { type: String, required: true },
    quantity: { type: Number, required: true },
    unitPrice: { type: Number, required: true },
    totalPrice: { type: Number, required: true },
  },
  { _id: false },
);

const StripeDataSchema = new mongoose.Schema(
  {
    paymentIntentId: String,
    paymentLinkId: String,
    checkoutSessionId: String,
    chargeId: String,
    lastPaymentError: String,
    invoiceUrl: { type: String, default: null },
    receiptNumber: String,
    refundId: String,
    refundStatus: {
      type: String,
      enum: RefundStatus,
    },
    refundAmount: Number,
    refundReason: String,
    refundFailureReason: String,
  },
  { _id: false },
);

const PaymentSchema = new mongoose.Schema<IPayment>(
  {
    order: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Order",
      required: true,
      unique: true,
    },
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    paymentIntentId: { type: String, unique: true, sparse: true },
    paymentLinkId: { type: String },
    paymentMethod: {
      type: String,
      enum: Object.values(PaymentMethod),
      default: PaymentMethod.STRIPE,
    },
    status: {
      type: String,
      enum: Object.values(PaymentStatus),
      default: PaymentStatus.PENDING,
      index: true,
    },
    amount: { type: Number, required: true },
    currency: { type: String, default: "usd" },
    items: [PaymentItemSchema],
    stripeData: StripeDataSchema,
    paidAt: { type: Date, index: true },
    failedAt: { type: Date },
    refundedAt: { type: Date },
    refundStatus: {
      type: String,
      enum: RefundStatus,
      default: RefundStatus.PENDING,
    },
    metadata: mongoose.Schema.Types.Mixed,
    failedReason: { type: String },
  },
  { timestamps: true },
);

// Indexes for efficient queries
PaymentSchema.index({ orderId: 1 });
PaymentSchema.index({ userId: 1, createdAt: -1 });
PaymentSchema.index({ user: 1, status: 1 }); // For pending order checks

PaymentSchema.plugin(mongoosePaginate);

export default mongoose.model<IPayment, PaginateModel<IPayment>>(
  "Payment",
  PaymentSchema,
  "payments",
);
