import { Request, Response } from 'express';
import { outboxWorker } from '../services/outbox.service.js';
import { prisma } from '../config/db.js';

export class OutboxController {
  // 1. POST /api/v1/outbox/process - Unified Processor for ALL outbox event types
  // Processes both BATCH_VALIDATION and CERTIFICATE_ISSUED (WhatsApp)
  async processAllOutboxEvents(req: Request, res: Response): Promise<void> {
    try {
      const batchSize = req.body.batchSize ? parseInt(req.body.batchSize, 10) : 50;

      const results = await outboxWorker.pollAndProcess(batchSize);

      const batchValidationEvents = results.filter((r) => r.eventType === 'BATCH_VALIDATION');
      const whatsappDeliveryEvents = results.filter((r) => r.eventType === 'CERTIFICATE_ISSUED');

      const batchPassed = batchValidationEvents.filter((r) => r.success).length;
      const batchFailed = batchValidationEvents.filter((r) => !r.success).length;

      const whatsappDelivered = whatsappDeliveryEvents.filter((r) => r.success && !r.idempotentSkip).length;
      const whatsappSkipped = whatsappDeliveryEvents.filter((r) => r.idempotentSkip).length;
      const whatsappFailed = whatsappDeliveryEvents.filter((r) => !r.success).length;

      res.status(200).json({
        success: true,
        message: `Processed ${results.length} total outbox event(s).`,
        summary: {
          totalProcessed: results.length,
          batchValidation: {
            total: batchValidationEvents.length,
            passed: batchPassed,
            failed: batchFailed
          },
          whatsappDelivery: {
            total: whatsappDeliveryEvents.length,
            dispatched: whatsappDelivered,
            skippedAlreadyDelivered: whatsappSkipped,
            retriedDueToTimeout: whatsappFailed
          }
        },
        data: results
      });
    } catch (error: any) {
      res.status(400).json({
        success: false,
        message: error.message || 'Failed to process outbox events.'
      });
    }
  }

  // 2. GET /api/v1/outbox/status - Real-time queue counters grouped by status & eventType
  async getOutboxStatus(_req: Request, res: Response): Promise<void> {
    try {
      const [pending, processing, published, failed, eventTypes] = await Promise.all([
        prisma.outbox.count({ where: { status: 'PENDING' } }),
        prisma.outbox.count({ where: { status: 'PROCESSING' } }),
        prisma.outbox.count({ where: { status: 'PUBLISHED' } }),
        prisma.outbox.count({ where: { status: 'FAILED' } }),
        prisma.outbox.groupBy({
          by: ['eventType', 'status'],
          _count: { id: true }
        })
      ]);

      res.status(200).json({
        success: true,
        data: {
          total: pending + processing + published + failed,
          pending,
          processing,
          published,
          failed,
          breakdownByEvent: eventTypes.map((e) => ({
            eventType: e.eventType,
            status: e.status,
            count: e._count.id
          }))
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

export const outboxController = new OutboxController();
