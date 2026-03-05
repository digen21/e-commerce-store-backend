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

export enum RefundStatus {
  PENDING = "PENDING",
  SUCCEEDED = "SUCCEEDED",
  PROCESSING = "PROCESSING",
  FAILED = "FAILED",
  CANCELLED = "CANCELLED",
}
export interface StripeData {
  paymentIntentId?: string;
  paymentLinkId?: string;
  checkoutSessionId?: string;
  chargeId?: string;
  lastPaymentError?: string;
  invoiceUrl?: string | null;
  receiptNumber?: string;
  refundId?: string;
  refundStatus?: RefundStatus;
  refundAmount?: number;
  refundReason?: string;
  refundFailureReason?: string;
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
  stripeData?: StripeData;
  paidAt?: Date;
  failedAt?: Date;
  refundedAt?: Date;
  failedReason?: string;
  refundStatus?: RefundStatus;
  metadata?: Record<string, string>;
  createdAt: Date;
  updatedAt: Date;
}

export type IPaymentDoc = HydratedDocument<IPayment>;
