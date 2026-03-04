import { NextFunction, Request, Response } from "express";
import { MongooseError } from "mongoose";
import httpStatus from "http-status";

import { ErrorType } from "@types";
import { logger, ServerError } from "@utils";

const errorHandler = (
  err: ErrorType,
  _: Request,
  res: Response,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _next: NextFunction,
) => {
  if (err instanceof MongooseError) {
    logger.error("MongooseError: ", {
      error: err,
      context: "MongooseError",
    });
    return res.status(httpStatus.BAD_REQUEST).send({
      message: err.message,
      status: httpStatus.BAD_REQUEST,
    });
  }
  if (err instanceof ServerError) {
    // custom error
    logger.error("Server Error: ", {
      error: err,
      context: "ServerError",
    });

    return res.status(err.status).send({
      status: err.status,
      message: err.message,
    });
  }

  // unhandled error
  logger.error("Unwanted Error", {
    error: err instanceof Error ? err.stack : err,
    context: "UnknownError",
  });

  return res.status(httpStatus.INTERNAL_SERVER_ERROR).send({
    message: "Internal Server Error",
    status: httpStatus.INTERNAL_SERVER_ERROR,
  });
};

export default errorHandler;
