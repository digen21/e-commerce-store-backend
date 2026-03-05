import { NextFunction, Request, Response } from "express";
import httpStatus from "http-status";

import { adminProfileService, analyticsLogger } from "@services";
import { IAdminProfile, IUser } from "@types";
import { catchAsync, ServerError } from "@utils";

class AdminController {
  getProfile = catchAsync(
    async (req: Request, res: Response, next: NextFunction) => {
      const userId = (req.user as IUser)._id;

      const profile = await adminProfileService.findOne({ user: userId });

      if (!profile) {
        return next(
          new ServerError({
            message:
              "Admin profile not found. Please create your store profile first.",
            status: httpStatus.NOT_FOUND,
          }),
        );
      }

      return res.status(httpStatus.OK).send({
        success: true,
        data: profile,
        status: httpStatus.OK,
      });
    },
  );

  createOrUpdateProfile = catchAsync(
    async (req: Request, res: Response, next: NextFunction) => {
      const userId = (req.user as IUser)._id;
      const profileData = req.body;

      // Check if profile already exists
      const existingProfile = await adminProfileService.findOne({
        user: userId,
      });

      let profile: IAdminProfile;

      if (existingProfile) {
        // Update existing profile
        const updatedProfile = await adminProfileService.update(
          { user: userId },
          profileData,
        );

        if (!updatedProfile) {
          return next(
            new ServerError({
              message: "Failed to update admin profile",
              status: httpStatus.INTERNAL_SERVER_ERROR,
            }),
          );
        }

        profile = updatedProfile as unknown as IAdminProfile;
      } else {
        // Create new profile
        const newProfile = await adminProfileService.create({
          user: userId,
          ...profileData,
        });

        if (!newProfile) {
          return next(
            new ServerError({
              message: "Failed to create admin profile",
              status: httpStatus.INTERNAL_SERVER_ERROR,
            }),
          );
        }

        profile = newProfile as unknown as IAdminProfile;
      }

      return res.status(httpStatus.OK).send({
        success: true,
        message: existingProfile
          ? "Admin profile updated successfully"
          : "Admin profile created successfully",
        data: profile,
        status: httpStatus.OK,
      });
    },
  );

  getSalesPerformance = catchAsync(async (req: Request, res: Response) => {
    const { period } = req.query as { period: "weekly" | "monthly" };

    if (!period || !["weekly", "monthly"].includes(period)) {
      throw new ServerError({
        message: "Invalid period. Must be 'weekly' or 'monthly'",
        status: httpStatus.BAD_REQUEST,
      });
    }

    const salesData = await analyticsLogger.getSalesPerformance(period);

    return res.status(httpStatus.OK).send({
      success: true,
      message: "Sales performance retrieved successfully",
      data: salesData,
      status: httpStatus.OK,
    });
  });

  getOrderStatusDistribution = catchAsync(
    async (_req: Request, res: Response) => {
      const distributionData =
        await analyticsLogger.getOrderStatusDistribution();

      return res.status(httpStatus.OK).send({
        success: true,
        message: "Order status distribution retrieved successfully",
        data: distributionData,
        status: httpStatus.OK,
      });
    },
  );

  getDashboardOverview = catchAsync(async (_req: Request, res: Response) => {
    const overviewData = await analyticsLogger.getDashboardOverview();

    return res.status(httpStatus.OK).send({
      success: true,
      message: "Dashboard overview retrieved successfully",
      data: overviewData,
      status: httpStatus.OK,
    });
  });
}

const adminController = new AdminController();
export default adminController;
