import express, { Express } from "express";

import adminRouter from "./admin.routes";
import authRouter from "./auth.routes";
import orderRouter from "./order.routes";
import paymentRouter from "./payment.routes";
import productRouter from "./product.routes";
import userDetailsRouter from "./userDetails.routes";

const useRoutes = (app: Express) => {
  const router = express.Router();

  router.use("/auth", authRouter);
  router.use("/products", productRouter);
  router.use("/users", userDetailsRouter);
  router.use("/orders", orderRouter);
  router.use("/payments", paymentRouter);
  router.use("/admin", adminRouter);

  app.use("/api", router);
};

export default useRoutes;
