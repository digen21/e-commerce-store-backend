import express from "express";

import { paymentController } from "@controllers";
import { isAuth, rateLimiter } from "@middlewares";

const paymentRouter = express.Router();

// Stripe webhook - NO rate limiting (Stripe needs to reach this)
paymentRouter.post(
  "/webhook",
  express.raw({ type: "application/json" }),
  paymentController.webhook,
);

// Payment link generation - rate limited
paymentRouter.get(
  "/generate-link",
  isAuth,
  rateLimiter,
  paymentController.generatePaymentLink,
);

export default paymentRouter;
