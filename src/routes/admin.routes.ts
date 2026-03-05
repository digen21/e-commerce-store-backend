import express from "express";

import { adminController } from "@controllers";
import { isAdminRole, isAuth, validate, rateLimiter } from "@middlewares";
import {
  adminProfileValidatorSchema,
  getSalesPerformanceValidatorSchema,
} from "@validators";

const adminRouter = express.Router();

// Admin profile routes (only accessible by ADMIN role)
adminRouter.get(
  "/profile",
  isAuth,
  isAdminRole,
  rateLimiter,
  adminController.getProfile,
);

adminRouter.put(
  "/profile",
  isAuth,
  isAdminRole,
  rateLimiter,
  validate(adminProfileValidatorSchema),
  adminController.createOrUpdateProfile,
);

// Admin analytics routes (only accessible by ADMIN role)
adminRouter.get(
  "/analytics/sales-performance",
  isAuth,
  isAdminRole,
  rateLimiter,
  validate(getSalesPerformanceValidatorSchema),
  adminController.getSalesPerformance,
);

adminRouter.get(
  "/analytics/order-status-distribution",
  isAuth,
  isAdminRole,
  rateLimiter,
  adminController.getOrderStatusDistribution,
);

adminRouter.get(
  "/analytics/dashboard-overview",
  isAuth,
  isAdminRole,
  rateLimiter,
  adminController.getDashboardOverview,
);

export default adminRouter;
