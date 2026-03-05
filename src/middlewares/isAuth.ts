import { omitPassword } from "@utils";
import { NextFunction, Request, Response } from "express";
import httpStatus from "http-status";
import passport from "passport";

type User = Express.User | false | null;

const isAuth = (req: Request, res: Response, next: NextFunction) => {
  passport.authenticate(
    "jwt",
    { session: false },
    (err: unknown, user: User) => {
      if (err) return next(err);

      if (!user)
        return res.status(httpStatus.UNAUTHORIZED).json({
          message: "Unauthorized",
          status: httpStatus.UNAUTHORIZED,
        });

      req.user = omitPassword(user);
      next();
    },
  )(req, res, next);
};

export default isAuth;
