import dotenv from "dotenv";
import path from "path";

dotenv.config({ path: path.resolve(__dirname, "../../.env") });

interface Config {
  nodeEnv: string;
  port: number;
  mongodbUri: string;
  jwt: {
    accessSecret: string;
    refreshSecret: string;
    accessExpiry: string;
    refreshExpiry: string;
  };
  cors: {
    origin: string;
  };
  logging: {
    level: string;
  };
}

const config: Config = {
  nodeEnv: process.env["NODE_ENV"] || "development",
  port: parseInt(process.env["PORT"] || "3000", 10),
  mongodbUri:
    process.env["MONGODB_URI"] || "mongodb://localhost:27017/civicpulse",
  jwt: {
    accessSecret: process.env["JWT_ACCESS_SECRET"] || "default-access-secret",
    refreshSecret:
      process.env["JWT_REFRESH_SECRET"] || "default-refresh-secret",
    accessExpiry: process.env["JWT_ACCESS_EXPIRY"] || "15m",
    refreshExpiry: process.env["JWT_REFRESH_EXPIRY"] || "7d",
  },
  cors: {
    origin: process.env["CORS_ORIGIN"] || "http://localhost:4200",
  },
  logging: {
    level: process.env["LOG_LEVEL"] || "info",
  },
};

export default config;
