import { Request, Response } from 'express';
import { outboxWorker } from '../services/outbox.service.js';
import { prisma } from '../config/db.js';

export class DeliveryController {
  // 1. POST /api/v1/delivery/whatsapp/process - Trigger on-demand outbox dispatch
  async processOutbox(req: Request, res: Response): Promise<void> {
    try {
      const batchSize = req.body.batchSize ? parseInt(req.body.batchSize, 10) : 50;

      const results = await outboxWorker.pollAndProcess(batchSize);

      const dispatched = results.filter((r) => r.success && !r.idempotentSkip).length;
      const skipped = results.filter((r) => r.idempotentSkip).length;
      const failed = results.filter((r) => !r.success).length;

      res.status(200).json({
        success: true,
        message: `Processed ${results.length} outbox delivery event(s).`,
        summary: {
          totalProcessed: results.length,
          dispatched,
          skippedAlreadyDelivered: skipped,
          retriedDueToTimeout: failed
        },
        data: results
      });
    } catch (error: any) {
      res.status(400).json({
        success: false,
        message: error.message || 'Failed to process outbox deliveries.'
      });
    }
  }

  // 2. GET /api/v1/delivery/logs - View audit delivery logs
  async getDeliveryLogs(req: Request, res: Response): Promise<void> {
    try {
      const page = req.query.page ? parseInt(req.query.page as string, 10) : 1;
      const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 20;
      const skip = (page - 1) * limit;

      const [total, logs] = await prisma.$transaction([
        prisma.deliveryLog.count(),
        prisma.deliveryLog.findMany({
          skip,
          take: limit,
          orderBy: { createdAt: 'desc' },
          include: {
            certificate: {
              select: {
                certificateNumber: true,
                verificationCode: true,
                candidate: {
                  select: { fullName: true }
                },
                batch: {
                  select: { batchNumber: true, courseName: true }
                }
              }
            }
          }
        })
      ]);

      res.status(200).json({
        success: true,
        data: logs,
        pagination: {
          total,
          page,
          limit,
          totalPages: Math.ceil(total / limit)
        }
      });
    } catch (error: any) {
      res.status(400).json({
        success: false,
        message: error.message || 'Failed to fetch delivery logs.'
      });
    }
  }

  // 3. GET /api/v1/delivery/outbox - View current outbox status
  async getOutboxStatus(_req: Request, res: Response): Promise<void> {
    try {
      const [pending, processing, published, failed] = await Promise.all([
        prisma.outbox.count({ where: { status: 'PENDING' } }),
        prisma.outbox.count({ where: { status: 'PROCESSING' } }),
        prisma.outbox.count({ where: { status: 'PUBLISHED' } }),
        prisma.outbox.count({ where: { status: 'FAILED' } })
      ]);

      res.status(200).json({
        success: true,
        data: {
          pending,
          processing,
          published,
          failed,
          total: pending + processing + published + failed
        }
      });
    } catch (error: any) {
      res.status(400).json({
        success: false,
        message: error.message || 'Failed to fetch outbox status.'
      });
    }
  }
}

export const deliveryController = new DeliveryController();
