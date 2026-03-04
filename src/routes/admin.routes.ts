import express from "express";

import { adminController } from "@controllers";
import { isAdminRole, isAuth, validate, rateLimiter } from "@middlewares";
import { adminProfileValidatorSchema } from "@validators";

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

export default adminRouter;
