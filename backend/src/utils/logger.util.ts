import winston from "winston";
import config from "../config";
import path from "node:path";

export const logFormat = winston.format.combine(
  winston.format.timestamp({ format: "YYYY-MM-DD HH:mm:ss" }),
  winston.format.errors({ stack: true }),
  winston.format.printf(({ timestamp, level, message, stack, ...meta }) => {
    const metaStr = Object.keys(meta).length ? ` ${JSON.stringify(meta)}` : "";
    let stackStr = "";
    if (stack) {
      const formattedStack =
        typeof stack === "string" ? stack : JSON.stringify(stack);
      stackStr = `\n${formattedStack}`;
    }
    return `[${timestamp}] ${level.toUpperCase()}: ${message}${metaStr}${stackStr}`;
  }),
);

export const consoleFormat = winston.format.combine(
  winston.format.colorize(),
  winston.format.timestamp({ format: "HH:mm:ss" }),
  winston.format.printf(({ timestamp, level, message, stack }) => {
    let stackStr = "";
    if (stack) {
      const formattedStack =
        typeof stack === "string" ? stack : JSON.stringify(stack);
      stackStr = `\n${formattedStack}`;
    }
    return `[${timestamp}] ${level}: ${message}${stackStr}`;
  }),
);

const transports: winston.transport[] = [
  new winston.transports.Console({
    format: consoleFormat,
  }),
];

if (config.nodeEnv === "production") {
  transports.push(
    new winston.transports.File({
      filename: path.resolve("logs", "error.log"),
      level: "error",
      format: logFormat,
      maxsize: 5242880, // 5MB
      maxFiles: 5,
    }),
    new winston.transports.File({
      filename: path.resolve("logs", "combined.log"),
      format: logFormat,
      maxsize: 5242880,
      maxFiles: 5,
    }),
  );
}

export const logger = winston.createLogger({
  level: config.logging.level,
  format: logFormat,
  transports,
  exitOnError: false,
});
