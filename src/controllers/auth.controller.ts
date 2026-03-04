import bcrypt from "bcrypt";
import { Request, Response } from "express";
import httpStatus from "http-status";
import jwt from "jsonwebtoken";
import mongoose from "mongoose";

import { env } from "@config";
import { Token, User } from "@models";
import { mailService, tokenService, userService } from "@services";
import { IUserDoc } from "@types";
import { catchAsync, logger, ServerError } from "@utils";

class AuthController {
  register = catchAsync(async (req: Request, res: Response) => {
    const { email, password } = req.body;
    const normalizedEmail = email.trim().toLowerCase();

    const user = await userService.findOne({
      email: { $regex: `^${email.trim()}$`, $options: "i" },
    });

    if (user)
      throw new ServerError({
        message: "User Already Exists...",
        status: httpStatus.BAD_REQUEST,
      });

    const hashPassword = await bcrypt.hash(password, 10);

    const result = (await userService.create({
      ...req.body,
      email: normalizedEmail,
      password: hashPassword,
    })) as IUserDoc;

    const verificationToken = await bcrypt.hash(result.id.toString(), 10);

    const isSent = await mailService.sendVerificationMail({
      email: result.email,
      id: result.id,
      verificationToken,
    });

    if (isSent) {
      await tokenService.create({
        token: verificationToken,
        user: result._id,
        expiresAt: new Date(Date.now() + 15 * 60 * 1000),
        type: "VERIFICATION_TOKEN",
      });
    }

    if (result) {
      return res.status(httpStatus.CREATED).send({
        success: true,
        message: "Verification email is sent to you email, please verify.",
        status: httpStatus.CREATED,
      });
    }

    throw new ServerError({
      message: "Check email or password",
      status: httpStatus.BAD_REQUEST,
    });
  });

  login = catchAsync(async (req: Request, res: Response) => {
    const { password, email } = req.body;

    const user = await userService.findOne(
      {
        email: { $regex: `^${email.trim()}$`, $options: "i" },
      },
      {},
      {
        populate: {
          path: "role",
          select: "name",
        },
      },
    );

    if (!user) {
      throw new ServerError({
        message: "Invalid Credential",
        status: httpStatus.BAD_REQUEST,
      });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      throw new ServerError({
        message: "Unauthorized",
        status: httpStatus.UNAUTHORIZED,
      });
    }

    if (!user.isVerified) {
      throw new ServerError({
        message: "Please verify your email first",
        status: httpStatus.BAD_REQUEST,
      });
    }

    const token = jwt.sign(
      { userId: user.id, role: user.role },
      env.JWT_SECRET!,
      {
        expiresIn: "1d",
      },
    );

    res.cookie("access_token", token, {
      httpOnly: true,
      secure: env.IS_PROD,
      sameSite: "strict",
      maxAge: 24 * 60 * 60 * 1000,
    });

    return res.status(httpStatus.OK).send({
      success: true,
      status: httpStatus.OK,
      message: "Login Successfully",
    });
  });

  verifyMail = catchAsync(async (req: Request, res: Response) => {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      const tokenDetails = await Token.findOne({
        token: req.query.token,
        deletedAt: null,
      }).session(session);

      if (!tokenDetails) {
        logger.error("Token Details not found", { context: "Database" });
        throw new ServerError({
          message: "Invalid Token",
          status: httpStatus.BAD_REQUEST,
        });
      }

      //   if (tokenDetails.deletedAt)
      await User.findOneAndUpdate(
        {
          _id: tokenDetails.user,
        },
        { isVerified: true },
        { session },
      );

      await Token.findOneAndUpdate(
        {
          token: req.query.token,
        },
        { deletedAt: Date.now() },
        { session },
      );

      await session.commitTransaction();

      return res.send({
        success: true,
        message: "Mail verified",
        status: httpStatus.OK,
      });
    } catch (error) {
      logger.error("Error in verifyMail", {
        context: "Database Transaction",
        error,
      });
      await session.abortTransaction();
      session.endSession();
      throw error;
    }
  });

  forgotPassword = catchAsync(async (req: Request, res: Response) => {
    const { email } = req.body;
    const normalizedEmail = email.trim().toLowerCase();

    const user = await userService.findOne({
      email: { $regex: `^${normalizedEmail}$`, $options: "i" },
    });

    // Always return success to prevent email enumeration
    if (!user) {
      return res.status(httpStatus.OK).send({
        success: true,
        message:
          "If an account exists with this email, a password reset link has been sent.",
        status: httpStatus.OK,
      });
    }

    const resetToken = await bcrypt.hash(user.id.toString(), 10);

    const isSent = await mailService.sendResetPasswordMail({
      email: user.email,
      resetToken,
    });

    if (isSent) {
      await tokenService.create({
        token: resetToken,
        user: user._id,
        expiresAt: new Date(Date.now() + 60 * 60 * 1000), // 1 hour
        type: "RESET_PASSWORD_TOKEN",
      });
    }

    return res.status(httpStatus.OK).send({
      success: true,
      message:
        "If an account exists with this email, a password reset link has been sent.",
      status: httpStatus.OK,
    });
  });

  resetPassword = catchAsync(async (req: Request, res: Response) => {
    const { token, password } = req.body;

    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      const tokenDetails = await Token.findOne({
        token,
        type: "RESET_PASSWORD_TOKEN",
        deletedAt: null,
      }).session(session);

      if (!tokenDetails) {
        logger.error("Reset password token not found", { context: "Database" });
        throw new ServerError({
          message: "Invalid or expired token",
          status: httpStatus.BAD_REQUEST,
        });
      }

      const hashedPassword = await bcrypt.hash(password, 10);

      await User.findOneAndUpdate(
        {
          _id: tokenDetails.user,
        },
        {
          password: hashedPassword,
        },
        { session },
      );

      await Token.findOneAndUpdate(
        {
          token,
        },
        { deletedAt: Date.now() },
        { session },
      );

      await session.commitTransaction();

      return res.status(httpStatus.OK).send({
        success: true,
        message: "Password reset successfully",
        status: httpStatus.OK,
      });
    } catch (error) {
      logger.error("Error in resetPassword", {
        context: "Database Transaction",
        error,
      });
      await session.abortTransaction();
      session.endSession();
      throw error;
    }
  });

  logout = catchAsync(async (req: Request, res: Response) => {
    const token = req.cookies?.access_token;

    if (token && req.user) {
      // Blacklist the token to prevent reuse until it expires
      await tokenService.create({
        token,
        user: (req.user as IUserDoc)._id,
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
        type: "BLACKLISTED_TOKEN",
      });
    }

    res.clearCookie("access_token", {
      httpOnly: true,
      secure: env.IS_PROD,
      sameSite: "strict",
    });

    return res.status(httpStatus.OK).send({
      success: true,
      message: "Logged out successfully",
      status: httpStatus.OK,
    });
  });

  resendVerificationEmail = catchAsync(async (req: Request, res: Response) => {
    const { email } = req.body;
    const normalizedEmail = email.trim().toLowerCase();

    const user = await userService.findOne({
      email: { $regex: `^${normalizedEmail}$`, $options: "i" },
    });

    if (!user) {
      return res.status(httpStatus.OK).send({
        success: true,
        message:
          "If an account exists with this email and is not verified, a verification email has been sent.",
        status: httpStatus.OK,
      });
    }

    if (user.isVerified) {
      return res.status(httpStatus.BAD_REQUEST).send({
        success: false,
        message: "Email is already verified. Please login.",
        status: httpStatus.BAD_REQUEST,
      });
    }

    // Delete any existing verification tokens for this user
    await Token.updateMany(
      { user: user._id, type: "VERIFICATION_TOKEN", deletedAt: null },
      { deletedAt: Date.now() },
    );

    const verificationToken = await bcrypt.hash(user.id.toString(), 10);

    const isSent = await mailService.sendVerificationMail({
      email: user.email,
      id: user.id,
      verificationToken,
    });

    if (isSent) {
      await tokenService.create({
        token: verificationToken,
        user: user._id,
        expiresAt: new Date(Date.now() + 15 * 60 * 1000), // 15 minutes
        type: "VERIFICATION_TOKEN",
      });
    }

    return res.status(httpStatus.OK).send({
      success: true,
      message:
        "If an account exists with this email and is not verified, a verification email has been sent.",
      status: httpStatus.OK,
    });
  });
}

const authController = new AuthController();
export default authController;
