import { NextFunction, Request, Response } from "express";
import httpStatus from "http-status";
import { PaginateOptions } from "mongoose";

import { userDetailService, userService } from "@services";
import { IUser, IUserDetailsDoc, UserRoles } from "@types";
import {
  catchAsync,
  omitPassword,
  omitPasswordFromArray,
  ServerError,
} from "@utils";

const MAX_ADDRESSES = 5;

class UserDetailsController {
  getMyDetails = catchAsync(async (req: Request, res: Response) => {
    const userId = (req.user as IUser)._id;

    let userDetails = await userDetailService.findOne({ user: userId });

    if (!userDetails) {
      userDetails = (await userDetailService.create({
        user: userId,
        addresses: [],
      })) as IUserDetailsDoc;
    }

    const user = await userService.findById(userId);

    if (!user) {
      throw new ServerError({
        message: "User not found",
        status: httpStatus.NOT_FOUND,
      });
    }

    const userWithoutPassword = omitPassword(user.toObject());

    return res.status(httpStatus.OK).send({
      success: true,
      message: "User details retrieved successfully",
      data: {
        user: userWithoutPassword,
        details: {
          addresses: userDetails.addresses,
          stats: userDetails.stats,
        },
      },
      status: httpStatus.OK,
    });
  });

  updateMyDetails = catchAsync(
    async (req: Request, res: Response, next: NextFunction) => {
      const userId = (req.user as IUser)._id;
      const { addresses } = req.body;

      let userDetails = await userDetailService.findOne({ user: userId });

      if (!userDetails) {
        userDetails = (await userDetailService.create({
          user: userId,
          addresses: addresses ?? [],
        })) as IUserDetailsDoc;
      } else {
        if (addresses) {
          if (userDetails.addresses.length + addresses.length > MAX_ADDRESSES) {
            return next(
              new ServerError({
                message: `Maximum ${MAX_ADDRESSES} are allowed`,
                status: httpStatus.CONFLICT,
              }),
            );
          }

          const updated = await userDetailService.update(
            { user: userId },
            { $push: { addresses: { $each: addresses } } },
            { new: true },
          );
          if (updated) userDetails = updated;
        }
      }

      return res.status(httpStatus.OK).send({
        success: true,
        message: "User details updated successfully",
        data: userDetails,
        status: httpStatus.OK,
      });
    },
  );

  getAllUsers = catchAsync(async (req: Request, res: Response) => {
    const { page = 1, limit = 10, search } = req.query;

    const query: Record<string, unknown> = {};
    query.role = UserRoles.USER;

    if (search) {
      query.$or = [
        { name: { $regex: search, $options: "i" } },
        { email: { $regex: search, $options: "i" } },
      ];
    }

    const options: PaginateOptions = {
      page: Number(page),
      limit: Number(limit),
      sort: { createdAt: -1 },
      lean: true,
    };

    const result = await userService.paginate(query, options);

    const usersWithoutPassword = omitPasswordFromArray(
      result.docs.map((doc) => doc as unknown as IUser),
    );

    return res.status(httpStatus.OK).send({
      success: true,
      message: "Users retrieved successfully",
      data: usersWithoutPassword,
      pagination: {
        totalDocs: result.totalDocs,
        limit: result.limit,
        page: result.page,
        totalPages: result.totalPages,
        hasNextPage: result.hasNextPage,
        hasPrevPage: result.hasPrevPage,
        nextPage: result.nextPage,
        prevPage: result.prevPage,
      },
      status: httpStatus.OK,
    });
  });

  getUserById = catchAsync(
    async (req: Request, res: Response, next: NextFunction) => {
      const { id } = req.params as { id: string };

      const user = await userService.findById(id);

      if (!user) {
        return next(
          new ServerError({
            message: "User not found",
            status: httpStatus.NOT_FOUND,
          }),
        );
      }

      const userWithoutPassword = omitPassword(user.toObject());

      const userDetails = (await userDetailService.findOne({
        user: user._id,
      })) as IUserDetailsDoc;

      return res.status(httpStatus.OK).send({
        success: true,
        message: "User retrieved successfully",
        data: {
          user: userWithoutPassword,
          details: userDetails
            ? {
                addresses: userDetails.addresses,
                stats: userDetails.stats,
              }
            : null,
        },
        status: httpStatus.OK,
      });
    },
  );

  getUserDetails = catchAsync(
    async (req: Request, res: Response, next: NextFunction) => {
      const { id } = req.params as { id: string };
      const currentUserId = (req.user as IUser)._id;

      if (id !== currentUserId.toString()) {
        return next(
          new ServerError({
            message: "Unauthorized to view this user's details",
            status: httpStatus.FORBIDDEN,
          }),
        );
      }

      const user = await userService.findById(id);

      if (!user) {
        return next(
          new ServerError({
            message: "User not found",
            status: httpStatus.NOT_FOUND,
          }),
        );
      }

      const userWithoutPassword = omitPassword(user.toObject());

      let userDetails = await userDetailService.findOne({ user: user._id });

      if (!userDetails) {
        userDetails = (await userDetailService.create({
          user: user._id,
        })) as IUserDetailsDoc;
      }

      return res.status(httpStatus.OK).send({
        success: true,
        message: "User details retrieved successfully",
        data: {
          user: userWithoutPassword,
          details: {
            addresses: userDetails.addresses,
            stats: userDetails.stats,
          },
        },
        status: httpStatus.OK,
      });
    },
  );
}

const userDetailsController = new UserDetailsController();
export default userDetailsController;
