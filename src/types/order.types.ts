import { HydratedDocument, Types } from "mongoose";

import type { PaymentStatus } from "./payment.types";

export enum OrderStatus {
  CREATED = "CREATED",
  PENDING = "PENDING",
  ACCEPTED = "ACCEPTED",
  CONFIRMED = "CONFIRMED",
  CANCELLED = "CANCELLED",
  SHIPPING = "SHIPPING",
  FULFILLED = "FULFILLED",
  FAILED = "FAILED",
}

export interface IPaymentStatusTimeline {
  successAt?: Date;
  failedAt?: Date;
  cancelledAt?: Date;
}

export interface IOrderStatusTimeline {
  acceptedAt?: Date;
  confirmedAt?: Date;
  cancelledAt?: Date;
  shippedAt?: Date;
  fulfilledAt?: Date;
}

export interface IOrderItem {
  product: Types.ObjectId;
  price: number;
  quantity: number;
}

export interface IOrder {
  _id: Types.ObjectId;
  user: Types.ObjectId;
  address?: Types.ObjectId;
  paymentId?: Types.ObjectId;
  items: IOrderItem[];
  subtotal: number;
  taxRate: number;
  taxAmount: number;
  cgstAmount?: number;
  sgstAmount?: number;
  totalAmount: number;

  paymentStatus: PaymentStatus;
  orderStatus: OrderStatus;

  paymentStatusTimeline?: IPaymentStatusTimeline;
  orderStatusTimeLine?: IOrderStatusTimeline;

  estimatedDeliveryDate?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export type IOrderDoc = HydratedDocument<IOrder>;
