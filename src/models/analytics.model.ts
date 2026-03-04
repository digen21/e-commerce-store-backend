import { EventType, IAnalytics, IAnalyticsMetaData } from "@types";
import mongoose, { PaginateModel } from "mongoose";

const AnalyticsMetaDataSchema = new mongoose.Schema<IAnalyticsMetaData>(
  {
    product: mongoose.Schema.Types.ObjectId,
    quantity: Number,
    price: Number,
    cartValue: Number,
    order: mongoose.Schema.Types.ObjectId,
  },
  { _id: false },
);

const AnalyticsSchema = new mongoose.Schema<IAnalytics>(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    eventType: {
      type: String,
      enum: Object.values(EventType),
      required: true,
    },
    metadata: AnalyticsMetaDataSchema,
  },
  { timestamps: true },
);

export default mongoose.model<IAnalytics, PaginateModel<IAnalytics>>(
  "Analytics",
  AnalyticsSchema,
  "analytics",
);
