import { NextFunction, Request, Response } from "express";
import httpStatus from "http-status";

import { IUser, UserRoles } from "@types";

type ExtendedRequest = Request & {
  user: IUser;
};

const allowedRoles =
  (roles: string | string[]) =>
  (req: ExtendedRequest, res: Response, next: NextFunction) => {
    const allowed = Array.isArray(roles) ? roles : [roles];
    const user = req.user;
    const userRoles = Array.isArray(user?.role) ? user.role : [user?.role];
    if (userRoles.some((r) => allowed.includes(r))) return next();
    return res
      .status(httpStatus.FORBIDDEN)
      .json({ message: "Forbidden", status: httpStatus.FORBIDDEN });
  };

export const isAdminRole = allowedRoles(UserRoles.ADMIN);
export const isUserRole = allowedRoles(UserRoles.USER);

export default allowedRoles;
