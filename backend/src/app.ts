import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import { isCelebrateError } from 'celebrate';
import { config } from './config/env.js';
import { prisma } from './config/db.js';
import authRoutes from './routes/auth.routes.js';
import batchRoutes from './routes/batch.routes.js';
import districtRoutes from './routes/district.routes.js';

export const createApp = () => {
  const app = express();

  // Middlewares
  app.use(cors({
    origin: config.corsOrigin,
    credentials: true
  }));
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  // Request logger
  app.use((req: Request, _res: Response, next: NextFunction) => {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
    next();
  });

  // Health check with DB status
  app.get('/health', async (_req: Request, res: Response) => {
    try {
      await prisma.$queryRaw`SELECT 1`;
      res.status(200).json({
        status: 'ok',
        service: 'CertiFlow API',
        database: 'connected',
        timestamp: new Date().toISOString(),
        uptime: process.uptime()
      });
    } catch {
      res.status(503).json({
        status: 'degraded',
        service: 'CertiFlow API',
        database: 'disconnected',
        timestamp: new Date().toISOString(),
        uptime: process.uptime()
      });
    }
  });

  // REST API Routes
  app.use('/api/v1/auth', authRoutes);
  app.use('/api/v1/batches', batchRoutes);
  app.use('/api/v1/district', districtRoutes);

  // Root API route
  app.get('/api/v1', (_req: Request, res: Response) => {
    res.json({
      message: 'Welcome to CertiFlow Skilling Certificate Issuance Platform API',
      version: '1.0.0'
    });
  });

  // 404 handler
  app.use((_req: Request, res: Response) => {
    res.status(404).json({
      success: false,
      message: 'Endpoint not found'
    });
  });

  // Custom Celebrate / Joi validation error formatter
  app.use((err: any, _req: Request, res: Response, next: NextFunction) => {
    if (isCelebrateError(err)) {
      const errorDetails: string[] = [];
      for (const [_segment, joiError] of err.details.entries()) {
        joiError.details.forEach((d) => errorDetails.push(d.message));
      }
      res.status(400).json({
        success: false,
        message: errorDetails[0] || 'Validation failed.',
        errors: errorDetails
      });
      return;
    }
    next(err);
  });

  // Global Error handler
  app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
    console.error('Unhandled Application Error:', err);
    res.status(500).json({
      success: false,
      message: err.message || 'Internal Server Error'
    });
  });

  return app;
};
