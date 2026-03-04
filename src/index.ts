import compression from "compression";
import cookieParser from "cookie-parser";
import express from "express";
import helmet from "helmet";
import httpStatus from "http-status";

import { connectDatabase, env } from "@config";

import {
  errorHandler,
  initCors,
  initPassport,
  requestLogger,
} from "@middlewares";
import useRoutes from "@routes";
import { logger } from "@utils";

const app = express();

app.set("trust proxy", 1);

initCors(app);

app.use(requestLogger);

app.use(helmet());

app.use(cookieParser());

app.use(compression());

// Raw body for Stripe webhook (must be before express.json())
app.use("/api/payments/webhook", express.raw({ type: "application/json" }));
app.use(express.json());

connectDatabase();

initPassport(app);

app.get("/health", (_, res) =>
  res.status(httpStatus.OK).json({
    status: "up",
  }),
);

useRoutes(app);

app.use(errorHandler);

const server = app.listen(env.PORT, () =>
  logger.info(`Server started on port ${env.PORT}`),
);

server.timeout = 30000;
