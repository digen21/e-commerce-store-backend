import { addColors, createLogger, format, transports } from "winston";
import util from "util";

const { combine, timestamp, printf, colorize } = format;

const customColors = {
  info: "blue",
  error: "red",
  warn: "yellow",
  debug: "green",
};

addColors(customColors);

// Custom format for local development
const logFormat = printf(({ level, message, timestamp, context, ...meta }) => {
  const metaString =
    Object.keys(meta).length > 0
      ? ` ${util.inspect(meta, { depth: null, colors: false })}`
      : "";

  return `${timestamp} ${level.toUpperCase()}${
    context ? ` [${context}]` : ""
  } ${message}${metaString}`;
});

const logger = createLogger({
  level: "info",
  format: format.combine(
    timestamp({ format: "YYYY-MM-DD HH:mm:ss" }),
    combine(colorize({ all: true }), logFormat),
  ),
  transports: [
    new transports.Console({
      format: format.simple(),
    }),
    new transports.File({ filename: "./logger/error.log", level: "error" }),
    new transports.File({ filename: "./logger/warn.log", level: "warn" }),
    new transports.File({ filename: "./logger/info.log", level: "info" }),
  ],
});

export default logger;
