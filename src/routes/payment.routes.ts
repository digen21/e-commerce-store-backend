import express from "express";

import { paymentController } from "@controllers";
import { isAuth, rateLimiter, validate } from "@middlewares";
import { getInvoiceValidatorSchema } from "@validators";

const paymentRouter = express.Router();

// Stripe webhook - NO rate limiting (Stripe needs to reach this)
paymentRouter.post(
  "/webhook",
  express.raw({ type: "application/json" }),
  paymentController.webhook,
);

// Get invoice for successful payment - rate limited
paymentRouter.get(
  "/invoices/:orderId",
  isAuth,
  rateLimiter,
  validate(getInvoiceValidatorSchema),
  paymentController.getInvoice,
);

export default paymentRouter;
