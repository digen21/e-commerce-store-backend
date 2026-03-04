import rateLimit from "express-rate-limit";
import httpStatus from "http-status";

export const rateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100,
  message: {
    success: false,
    message: "Too many requests from this IP, please try again later.",
    status: httpStatus.TOO_MANY_REQUESTS,
  },
  standardHeaders: true,
  legacyHeaders: false,
});

export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10,
  message: {
    success: false,
    message:
      "Too many authentication attempts from this IP, please try again later.",
    status: httpStatus.TOO_MANY_REQUESTS,
  },
  skipSuccessfulRequests: true,
});
