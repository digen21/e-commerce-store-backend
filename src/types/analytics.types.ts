import { HydratedDocument, Types } from "mongoose";

export enum EventType {
  ADD_TO_CART = "ADD_TO_CART",
  REMOVE_FROM_CART = "REMOVE_FROM_CART",
  CHECKOUT_START = "CHECKOUT_START",
  ORDER_SUCCESS = "ORDER_SUCCESS",
  ORDER_FAILED = "ORDER_FAILED",
  ORDER_CREATED = "ORDER_CREATED",
  ORDER_CONFIRMED = "ORDER_CONFIRMED",
  ORDER_CANCELLED = "ORDER_CANCELLED",
  ORDER_SHIPPED = "ORDER_SHIPPED",
  ORDER_FULFILLED = "ORDER_FULFILLED",
  ORDER_STATUS_CHANGED = "ORDER_STATUS_CHANGED",
  PAYMENT_SUCCESS = "PAYMENT_SUCCESS",
  PAYMENT_FAILED = "PAYMENT_FAILED",
  PAYMENT_REFUNDED = "PAYMENT_REFUNDED",
}

export interface IAnalyticsMetaData {
  product?: Types.ObjectId | string;
  quantity?: number;
  price?: number;
  cartValue?: number;
  order?: Types.ObjectId | string;
  orderStatus?: string;
  paymentStatus?: string;
  reason?: string;
}

export interface IAnalytics {
  _id: Types.ObjectId;
  user?: Types.ObjectId | string | null;
  eventType: EventType;
  metadata?: IAnalyticsMetaData;
  createdAt: Date;
  updatedAt: Date;
}

export interface AnalyticTrend {
  date: string;
  revenue: number;
  orders: number;
}
export interface AnalyticSummery {
  totalRevenue: number;
  totalOrders: number;
  averageOrderValue: number;
}
export interface SalePerformanceResponse {
  period: AnalyticPeriod;
  currency: "INR";
  trends: AnalyticTrend[];
  summary: AnalyticSummery;
}

export interface StatusDistribution {
  status: string;
  count: number;
  percentage: number;
  color: string;
}

export interface DashboardMetrics {
  productsChange: number;
  ordersChange: number;
  revenueChange: number;
  conversionChange: number;
}

export type AnalyticPeriod = "weekly" | "monthly";

export type IAnalyticsDoc = HydratedDocument<IAnalytics>;
