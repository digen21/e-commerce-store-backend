import { NextFunction, Request, Response } from "express";
import httpStatus from "http-status";

import { adminProfileService } from "@services";
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
}

const adminController = new AdminController();
export default adminController;
