import { Express, Request } from "express";
import httpStatus from "http-status";
import passport from "passport";
import { ExtractJwt, Strategy, VerifiedCallback } from "passport-jwt";

import { env } from "@config";
import { Token } from "@models";
import { userService } from "@services";
import { UserRoles } from "@types";
import { logger, ServerError } from "@utils";

export interface JwtUser {
  userId: string;
  role: UserRoles;
  iat: number;
}

const cookieExtractor = (req: Request) => req?.cookies?.access_token || null;

export default (app: Express) => {
  const options = {
    secretOrKey: env.JWT_SECRET,
    jwtFromRequest: ExtractJwt.fromExtractors([cookieExtractor]),
    passReqToCallback: true as const,
  };

  try {
    passport.use(
      new Strategy(
        options,
        async (req: Request, payload: JwtUser, done: VerifiedCallback) => {
          if (!payload) {
            return done(null, false);
          }

          // Check if the actual JWT token is blacklisted
          const token = cookieExtractor(req);
          if (token) {
            const isBlacklisted = await Token.findOne({
              token,
              type: "BLACKLISTED_TOKEN",
              deletedAt: null,
            });

            if (isBlacklisted) {
              return done(null, false);
            }
          }

          const userId = payload?.userId;
          const user = await userService.findById(userId, { password: 0 });

          return done(null, user || false);
        },
      ),
    );

    app.use(passport.initialize());
  } catch (error) {
    logger.error(error);
    throw new ServerError({
      message: "Unauthorized",
      status: httpStatus.UNAUTHORIZED,
    });
  }
};
