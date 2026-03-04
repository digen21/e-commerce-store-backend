import { HydratedDocument, Types } from "mongoose";

export enum PaymentMethod {
  STRIPE = "STRIPE",
}

export enum PaymentStatus {
  PENDING = "PENDING",
  PROCESSING = "PROCESSING",
  SUCCESS = "SUCCESS",
  COMPLETED = "COMPLETED",
  FAILED = "FAILED",
  REFUNDED = "REFUNDED",
  CANCELLED = "CANCELLED",
}

export const PAYMENT_STATUSES = [
  "PENDING",
  "PROCESSING",
  "SUCCESS",
  "COMPLETED",
  "FAILED",
  "REFUNDED",
  "CANCELLED",
] as const;

// export type PaymentStatus = (typeof PAYMENT_STATUSES)[number];

export interface IPaymentItem {
  productId: Types.ObjectId;
  productName: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
}

export interface IPayment {
  _id: Types.ObjectId;
  order: Types.ObjectId | string;
  user: Types.ObjectId | string;
  paymentIntentId?: string;
  paymentLinkId?: string;
  paymentMethod: PaymentMethod;
  status: PaymentStatus;
  amount: number;
  currency: string;
  items: IPaymentItem[];
  stripeData?: {
    paymentIntentId?: string;
    paymentLinkId?: string;
    checkoutSessionId?: string;
    chargeId?: string;
    lastPaymentError?: string;
  };
  paidAt?: Date;
  failedAt?: Date;
  refundedAt?: Date;
  metadata?: Record<string, string>;
  createdAt: Date;
  updatedAt: Date;
}

export type IPaymentDoc = HydratedDocument<IPayment>;
