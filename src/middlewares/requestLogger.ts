import type { NextFunction, Request, Response } from "express";

import { logger } from "@utils";

const requestLogger = (req: Request, res: Response, next: NextFunction) => {
  const start = Date.now();

  res.on("finish", () => {
    const duration = Date.now() - start;
    const message = `${req.method} ${req.originalUrl} ${res.statusCode} - ${duration}ms`;

    logger.info(message);
  });

  next();
};

export default requestLogger;
