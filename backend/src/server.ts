/**
 * CivicPulse AI — Express API Server Bootstrap
 * ============================================
 * Initializes database connectivity, starts HTTP listener on configured port,
 * and attaches graceful process termination shutdown handlers.
 */

import app from "./app";
import config from "./config";
import { connectDatabase, disconnectDatabase } from "./config/database.config";
import { logger } from "./utils/logger.util";

const startServer = async (): Promise<void> => {
  try {
    // Connect to MongoDB
    await connectDatabase();

    // Start Express server
    const server = app.listen(config.port, () => {
      logger.info(`🚀 CivicPulse API Server running on port ${config.port}`);
      logger.info(`📊 Environment: ${config.nodeEnv}`);
      logger.info(
        `🔗 Health check: http://localhost:${config.port}/api/health`,
      );
    });

    // Graceful shutdown handlers
    const gracefulShutdown = async (signal: string): Promise<void> => {
      logger.info(`${signal} received. Starting graceful shutdown...`);

      server.close(async () => {
        logger.info("HTTP server closed");
        await disconnectDatabase();
        logger.info("Graceful shutdown completed");
        process.exit(0);
      });

      // Force shutdown after 10 seconds
      setTimeout(() => {
        logger.error("Forced shutdown due to timeout");
        process.exit(1);
      }, 10000);
    };

    process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
    process.on("SIGINT", () => gracefulShutdown("SIGINT"));

    // Handle unhandled rejections
    process.on("unhandledRejection", (reason: unknown) => {
      logger.error("Unhandled Rejection:", reason);
    });

    // Handle uncaught exceptions
    process.on("uncaughtException", (error: Error) => {
      logger.error("Uncaught Exception:", error);
      process.exit(1);
    });
  } catch (error) {
    logger.error("Failed to start server:", error);
    process.exit(1);
  }
};

startServer();
