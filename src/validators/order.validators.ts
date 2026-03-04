import Joi from "joi";
import id from "./id.validators";
import { OrderStatus } from "../types/order.types";
import { PaymentStatus } from "../types/payment.types";

const OrderItemSchema = Joi.object({
  product: id,
  quantity: Joi.number().min(1).required(),
});

export const createOrderValidatorSchema = Joi.object({
  body: Joi.object({
    items: Joi.array().items(OrderItemSchema).min(1).required(),
    address: id.optional().required(),
  }),
});

export const cancelOrderValidatorSchema = Joi.object({
  params: Joi.object({
    id,
  }),
});

export const updateOrderStatusValidatorSchema = Joi.object({
  params: Joi.object({
    id,
  }),
  body: Joi.object({
    orderStatus: Joi.string()
      .valid(...Object.values(OrderStatus))
      .required(),
    paymentStatus: Joi.string().valid(...Object.values(PaymentStatus)),
  }),
});

export const getOrderValidatorSchema = Joi.object({
  params: Joi.object({
    id,
  }),
});

export const getOrdersValidatorSchema = Joi.object({
  query: Joi.object({
    page: Joi.number().positive().integer().default(1),
    limit: Joi.number().positive().integer().max(100).default(10),
    status: Joi.string().valid(...Object.values(OrderStatus)),
    minPrice: Joi.number().positive(),
    maxPrice: Joi.number().positive(),
    sortBy: Joi.string()
      .valid("createdAt", "updatedAt", "totalAmount", "orderStatus")
      .default("createdAt"),
    sortOrder: Joi.number().valid(1, -1).default(-1),
  }),
});

export const getAllOrdersValidatorSchema = Joi.object({
  query: Joi.object({
    page: Joi.number().positive().integer().default(1),
    limit: Joi.number().positive().integer().max(100).default(10),
    status: Joi.string().valid(...Object.values(OrderStatus)),
    paymentStatus: Joi.string().valid(...Object.values(PaymentStatus)),
    minPrice: Joi.number().positive(),
    maxPrice: Joi.number().positive(),
    sortBy: Joi.string()
      .valid(
        "createdAt",
        "updatedAt",
        "totalAmount",
        "orderStatus",
        "paymentStatus",
      )
      .default("createdAt"),
    sortOrder: Joi.number().valid(1, -1).default(-1),
  }),
});


