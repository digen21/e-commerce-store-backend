import express from "express";

import { userDetailsController } from "@controllers";
import { isAdminRole, isAuth, rateLimiter, validate } from "@middlewares";
import {
  createUserDetailsValidatorSchema,
  getUserDetailsValidatorSchema,
} from "@validators";

const userDetailsRouter = express.Router();

// Current user's own details (authenticated users)
userDetailsRouter.get(
  "/me",
  isAuth,
  rateLimiter,
  userDetailsController.getMyDetails,
);

userDetailsRouter.put(
  "/me",
  isAuth,
  rateLimiter,
  validate(createUserDetailsValidatorSchema),
  userDetailsController.updateMyDetails,
);

// Get user details by ID (authenticated users - own details only)
userDetailsRouter.get(
  "/:id",
  isAuth,
  rateLimiter,
  validate(getUserDetailsValidatorSchema),
  userDetailsController.getUserDetails,
);

// Admin-only routes - manage all users (read-only)
userDetailsRouter.get(
  "/",
  isAuth,
  isAdminRole,
  rateLimiter,
  userDetailsController.getAllUsers,
);

userDetailsRouter.get(
  "/admin/:id",
  isAuth,
  isAdminRole,
  rateLimiter,
  validate(getUserDetailsValidatorSchema),
  userDetailsController.getUserById,
);

export default userDetailsRouter;
