import type { IOrder } from "@types";
import { OrderStatus } from "../types/order.types";
import { PaymentStatus } from "../types/payment.types";
import mongoose, { PaginateModel } from "mongoose";
import mongoosePaginate from "mongoose-paginate-v2";

const StatusTimeLineSchema = new mongoose.Schema(
  {
    successAt: Date,
    failedAt: Date,
    cancelledAt: Date,
  },
  { _id: false },
);

const OrderTimeLineSchema = new mongoose.Schema(
  {
    acceptedAt: Date,
    confirmedAt: Date,
    cancelledAt: Date,
    shippedAt: Date,
    fulfilledAt: Date,
  },
  { _id: false },
);

const OrderItemSchema = new mongoose.Schema({
  product: { type: mongoose.Schema.Types.ObjectId, ref: "Product" },
  price: Number,
  quantity: Number,
});

const OrderSchema = new mongoose.Schema<IOrder>(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    address: { type: mongoose.Schema.Types.ObjectId, ref: "UserDetails" },
    paymentId: { type: mongoose.Schema.Types.ObjectId, ref: "Payment" },
    items: [OrderItemSchema],
    totalAmount: Number,
    paymentStatus: {
      type: String,
      enum: Object.values(PaymentStatus),
      default: PaymentStatus.PENDING,
    },
    orderStatus: {
      type: String,
      enum: Object.values(OrderStatus),
      default: OrderStatus.CREATED,
    },
    paymentStatusTimeline: StatusTimeLineSchema,
    orderStatusTimeLine: OrderTimeLineSchema,
  },
  { timestamps: true },
);

OrderSchema.index({ userId: 1, createdAt: -1 });
OrderSchema.index({ paymentStatus: 1 });
OrderSchema.index({ orderStatus: 1 });

OrderSchema.plugin(mongoosePaginate);
export default mongoose.model<IOrder, PaginateModel<IOrder>>(
  "Order",
  OrderSchema,
  "orders",
);


