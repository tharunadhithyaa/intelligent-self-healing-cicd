import morgan, { StreamOptions } from "morgan";
import { logger } from "../utils/logger.util";

const stream: StreamOptions = {
  write: (message: string) => {
    logger.http(message.trim());
  },
};

export const requestLogger = morgan(
  ":method :url :status :res[content-length] - :response-time ms",
  { stream },
);
