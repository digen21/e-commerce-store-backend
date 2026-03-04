import mongoose from "mongoose";

import { logger } from "@utils";
import env from "./envVariable";

export default () => {
  try {
    mongoose
      .connect(env.DATABASE_URL)
      .then(() => {
        logger.info("Connected To Database");
      })
      .catch((e) =>
        logger.error("Failed To Connect: ", {
          error: e,
          context: "Database connection",
        }),
      );
  } catch (error) {
    logger.error("Error Occurred While connecting database: ", { error });
    process.exit();
  }
};
