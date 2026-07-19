import express, { Application, Request, Response } from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { corsOptions } from './config/cors.config';
import { requestLogger } from './middleware/request-logger.middleware';
import { errorHandler } from './middleware/error.middleware';
import { securitySanitizer } from './middleware/security.middleware';
import authRoutes from './modules/auth/auth.routes';
import complaintRoutes from './modules/complaints/complaints.routes';
import citizenRoutes from './modules/citizen/citizen.routes';
import adminRoutes from './modules/admin/admin.routes';
import aiChatRoutes from './modules/ai-chat/ai-chat.routes';
import officerRoutes from './modules/officer/officer.routes';
import fieldWorkerRoutes from './modules/field-worker/field-worker.routes';
import notificationRoutes from './modules/notifications/notification.routes';

const app: Application = express();

// Security middleware
app.use(helmet());
app.use(cors(corsOptions));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Too many requests from this IP, please try again later.',
  },
});
app.use('/api/', limiter);

// Auth-specific stricter rate limit
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Too many authentication attempts, please try again later.',
  },
});
app.use('/api/auth/login', authLimiter);
app.use('/api/auth/register', authLimiter);

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(securitySanitizer);

// Request logging
app.use(requestLogger);

// Health check
app.get('/api/health', (_req: Request, res: Response) => {
  const dbState = mongoose.connection.readyState;
  const isDbConnected = dbState === 1;

  res.status(isDbConnected ? 200 : 503).json({
    success: isDbConnected,
    message: isDbConnected ? 'CivicPulse API is running' : 'CivicPulse API has degraded service',
    timestamp: new Date().toISOString(),
    environment: process.env['NODE_ENV'] || 'development',
    database: {
      status: isDbConnected ? 'up' : 'down',
      readyState: dbState
    }
  });
});

// API routes
app.use('/api/auth', authRoutes);
app.use('/api/complaints', complaintRoutes);
app.use('/api/citizen', citizenRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/ai-chat', aiChatRoutes);
app.use('/api/officer', officerRoutes);
app.use('/api/field-worker', fieldWorkerRoutes);
app.use('/api/notifications', notificationRoutes);

// 404 handler
app.use((_req: Request, res: Response) => {
  res.status(404).json({
    success: false,
    message: 'Route not found',
  });
});

// Global error handler (must be last)
app.use(errorHandler);

export default app;
