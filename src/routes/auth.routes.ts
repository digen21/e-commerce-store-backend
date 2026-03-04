import express from "express";
import httpStatus from "http-status";

import { authController } from "@controllers";
import { authLimiter, isAuth, rateLimiter, validate } from "@middlewares";
import {
  forgotPasswordValidatorSchema,
  loginValidatorSchema,
  registerValidatorSchema,
  resendVerificationEmailValidatorSchema,
  resetPasswordValidatorSchema,
  verifyMailValidatorSchema,
} from "@validators";

const authRouter = express.Router();

authRouter.post(
  "/register",
  authLimiter,
  validate(registerValidatorSchema),
  authController.register,
);

authRouter.post(
  "/login",
  authLimiter,
  validate(loginValidatorSchema),
  authController.login,
);

authRouter.post(
  "/verify-mail",
  rateLimiter,
  validate(verifyMailValidatorSchema),
  authController.verifyMail,
);

authRouter.post(
  "/forgot-password",
  authLimiter,
  validate(forgotPasswordValidatorSchema),
  authController.forgotPassword,
);

authRouter.post(
  "/reset-password",
  authLimiter,
  validate(resetPasswordValidatorSchema),
  authController.resetPassword,
);

authRouter.post(
  "/resend-verification-email",
  authLimiter,
  validate(resendVerificationEmailValidatorSchema),
  authController.resendVerificationEmail,
);

authRouter.post("/logout", isAuth, authController.logout);

authRouter.get("/profile", isAuth, (req, res) => {
  return res.status(httpStatus.OK).send({
    success: true,
    user: req.user,
    status: httpStatus.OK,
  });
});

export default authRouter;
