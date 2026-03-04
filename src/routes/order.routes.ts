import express from "express";

import { orderController } from "@controllers";
import {
  idempotencyMiddleware,
  isAdminRole,
  isAuth,
  rateLimiter,
  validate,
} from "@middlewares";
import {
  cancelOrderValidatorSchema,
  createOrderValidatorSchema,
  getAllOrdersValidatorSchema,
  getOrderValidatorSchema,
  getOrdersValidatorSchema,
  updateOrderStatusValidatorSchema,
} from "@validators";

const orderRouter = express.Router();

// User routes - manage own orders
orderRouter.post(
  "/",
  isAuth,
  rateLimiter,
  idempotencyMiddleware,
  validate(createOrderValidatorSchema),
  orderController.createOrder,
);

orderRouter.get(
  "/",
  isAuth,
  rateLimiter,
  validate(getOrdersValidatorSchema),
  orderController.getOrders,
);

orderRouter.get(
  "/:id",
  isAuth,
  rateLimiter,
  validate(getOrderValidatorSchema),
  orderController.getOrder,
);

orderRouter.post(
  "/:id/cancel",
  isAuth,
  rateLimiter,
  validate(cancelOrderValidatorSchema),
  orderController.cancelOrder,
);

// Admin routes - manage all orders
orderRouter.get(
  "/admin/all",
  isAuth,
  isAdminRole,
  rateLimiter,
  validate(getAllOrdersValidatorSchema),
  orderController.getAllOrders,
);

orderRouter.put(
  "/:id/status",
  isAuth,
  isAdminRole,
  rateLimiter,
  validate(updateOrderStatusValidatorSchema),
  orderController.updateOrderStatus,
);

export default orderRouter;
