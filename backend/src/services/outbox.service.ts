import { prisma } from '../config/db.js';
import { OutboxStatus, DeliveryStatus, BatchStatus } from '@prisma/client';
import { redis } from '../config/redis.js';
import crypto from 'crypto';

export interface DispatchResult {
  outboxId: string;
  eventType: string;
  aggregateId: string;
  recipientPhone?: string;
  success: boolean;
  providerMsgId?: string;
  error?: string;
  idempotentSkip?: boolean;
}

export class OutboxWorker {
  private isRunning: boolean = false;
  private intervalId: NodeJS.Timeout | null = null;

  /**
   * Starts the background polling poller
   * Automatically polls the Outbox table every pollIntervalMs
   */
  start(pollIntervalMs: number = 3000): void {
    if (this.intervalId) return;

    console.log(`📡 Transactional Outbox Poller active (interval: ${pollIntervalMs}ms)`);
    this.intervalId = setInterval(() => {
      this.pollAndProcess().catch((err) => {
        console.error('Error during outbox poll cycle:', err);
      });
    }, pollIntervalMs);
  }

  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
      console.log('🛑 Transactional Outbox Poller stopped.');
    }
  }

  /**
   * Polls pending outbox records and dispatches them safely
   */
  async pollAndProcess(batchSize: number = 20): Promise<DispatchResult[]> {
    if (this.isRunning) return []; // In-process concurrency guard

    // Distributed lock to prevent multiple worker instances from running concurrently
    const lockKey = 'lock:outbox:worker:poll';
    const lockToken = await redis.acquireLock(lockKey, 10000);
    if (!lockToken) return []; // Another worker instance is currently processing

    this.isRunning = true;

    try {
      const now = new Date();

      // Find pending or eligible retry events
      const events = await prisma.outbox.findMany({
        where: {
          status: { in: [OutboxStatus.PENDING, OutboxStatus.PROCESSING] },
          nextRetryAt: { lte: now }
        },
        take: batchSize,
        orderBy: { createdAt: 'asc' }
      });

      if (events.length === 0) return [];

      const results: DispatchResult[] = [];

      for (const event of events) {
        try {
          // =========================================================================
          // EVENT TYPE 1: ASYNC BATCH VALIDATION
          // =========================================================================
          if (event.eventType === 'BATCH_VALIDATION') {
            const res = await this.processBatchValidationEvent(event);
            results.push(res);
            continue;
          }

          // =========================================================================
          // EVENT TYPE 2: CERTIFICATE ISSUANCE & WHATSAPP DISPATCH
          // =========================================================================
          if (event.eventType === 'CERTIFICATE_ISSUED') {
            const res = await this.processCertificateDeliveryEvent(event);
            results.push(res);
            continue;
          }

          // Unknown event
          await prisma.outbox.update({
            where: { id: event.id },
            data: { status: OutboxStatus.PUBLISHED, publishedAt: new Date() }
          });
        } catch (itemError: any) {
          await this.handleRetry(event, itemError.message);
          results.push({
            outboxId: event.id,
            eventType: event.eventType,
            aggregateId: event.aggregateId,
            success: false,
            error: itemError.message
          });
        }
      }

      return results;
    } finally {
      this.isRunning = false;
      await redis.releaseLock(lockKey, lockToken);
    }
  }

  /**
   * Asynchronously validates raw candidate rows for an uploaded batch
   */
  private async processBatchValidationEvent(event: any): Promise<DispatchResult> {
    const payload = event.payload as any;
    const batchId = event.aggregateId;
    const rawRows = payload.rawRows as any[];
    const actorId = payload.actorId;

    // Validate rows
    const { batchService } = await import('./batch.service.js');
    const { valid, errors } = batchService.validateRows(rawRows);

    if (errors.length > 0) {
      // Validation Failed: Atomically mark batch VALIDATION_FAILED and save errors
      await prisma.$transaction(async (tx) => {
        await tx.batch.update({
          where: { id: batchId },
          data: {
            status: BatchStatus.VALIDATION_FAILED,
            validationErrors: errors as any,
            candidateCount: 0,
            lastActivityAt: new Date()
          }
        });

        await tx.outbox.update({
          where: { id: event.id },
          data: {
            status: OutboxStatus.PUBLISHED,
            publishedAt: new Date(),
            errorMessage: `Validation failed on ${errors.length} candidate rows.`
          }
        });

        await tx.auditLog.create({
          data: {
            entityType: 'BATCH',
            entityId: batchId,
            actorId,
            action: 'BATCH_VALIDATION_FAILED',
            metadata: JSON.parse(JSON.stringify({
              errorCount: errors.length,
              errors
            }))
          }
        });
      });

      return {
        outboxId: event.id,
        eventType: event.eventType,
        aggregateId: batchId,
        success: false,
        error: `Validation failed on ${errors.length} candidate rows.`
      };
    }

    // Validation Passed: Insert candidates and promote batch to DISTRICT_PENDING
    await prisma.$transaction(async (tx) => {
      // If resubmission, clean existing candidates first
      if (payload.isResubmit) {
        await tx.candidate.deleteMany({ where: { batchId } });
      }

      await tx.candidate.createMany({
        data: valid.map((c) => ({
          batchId,
          fullName: c.fullName,
          phoneNumber: c.phoneNumber,
          email: c.email || null
        }))
      });

      await tx.batch.update({
        where: { id: batchId },
        data: {
          status: BatchStatus.DISTRICT_PENDING,
          candidateCount: valid.length,
          validationErrors: undefined,
          lastActivityAt: new Date()
        }
      });

      await tx.outbox.update({
        where: { id: event.id },
        data: {
          status: OutboxStatus.PUBLISHED,
          publishedAt: new Date(),
          errorMessage: null
        }
      });

      await tx.auditLog.create({
        data: {
          entityType: 'BATCH',
          entityId: batchId,
          actorId,
          action: 'BATCH_VALIDATION_PASSED_PROMOTED_TO_DISTRICT_PENDING',
          metadata: {
            candidateCount: valid.length
          }
        }
      });
    });

    return {
      outboxId: event.id,
      eventType: event.eventType,
      aggregateId: batchId,
      success: true
    };
  }

  /**
   * Asynchronously delivers an issued certificate to WhatsApp
   */
  private async processCertificateDeliveryEvent(event: any): Promise<DispatchResult> {
    const payload = event.payload as any;
    const certificateId = event.aggregateId;
    const recipientPhone = payload.phoneNumber;

    // Strict Idempotency Check
    const alreadyDelivered = await prisma.deliveryLog.findFirst({
      where: {
        certificateId,
        recipientPhone,
        status: DeliveryStatus.DELIVERED
      }
    });

    if (alreadyDelivered) {
      await prisma.outbox.update({
        where: { id: event.id },
        data: {
          status: OutboxStatus.PUBLISHED,
          publishedAt: new Date()
        }
      });

      return {
        outboxId: event.id,
        eventType: event.eventType,
        aggregateId: certificateId,
        recipientPhone,
        success: true,
        providerMsgId: alreadyDelivered.providerMsgId || undefined,
        idempotentSkip: true
      };
    }

    // Mark as PROCESSING
    await prisma.outbox.update({
      where: { id: event.id },
      data: { status: OutboxStatus.PROCESSING }
    });

    // Mock WhatsApp API dispatch
    const dispatch = await this.mockWhatsAppSend(
      recipientPhone,
      payload.candidateName,
      payload.courseName,
      payload.certificateNumber,
      payload.verificationCode
    );

    if (dispatch.success) {
      await prisma.deliveryLog.create({
        data: {
          certificateId,
          recipientPhone,
          channel: 'WHATSAPP',
          status: DeliveryStatus.DELIVERED,
          providerMsgId: dispatch.providerMsgId,
          responsePayload: {
            provider: 'META_WHATSAPP_CLOUD_API',
            timestamp: new Date().toISOString(),
            messageStatus: 'delivered'
          }
        }
      });

      await prisma.outbox.update({
        where: { id: event.id },
        data: {
          status: OutboxStatus.PUBLISHED,
          publishedAt: new Date(),
          errorMessage: null
        }
      });

      return {
        outboxId: event.id,
        eventType: event.eventType,
        aggregateId: certificateId,
        recipientPhone,
        success: true,
        providerMsgId: dispatch.providerMsgId
      };
    } else {
      await this.handleRetry(event, dispatch.error || 'Simulated network timeout');
      return {
        outboxId: event.id,
        eventType: event.eventType,
        aggregateId: certificateId,
        recipientPhone,
        success: false,
        error: dispatch.error
      };
    }
  }

  /**
   * Simulates calling the official Meta WhatsApp Business API
   */
  private async mockWhatsAppSend(
    phoneNumber: string,
    _candidateName: string,
    _courseName: string,
    _certificateNumber: string,
    _verificationCode: string
  ): Promise<{ success: boolean; providerMsgId?: string; error?: string }> {
    if (!phoneNumber || phoneNumber.replace(/\D/g, '').length < 10) {
      return {
        success: false,
        error: 'Invalid recipient phone number format'
      };
    }

    const isTransientTimeout = Math.random() < 0.05;
    if (isTransientTimeout) {
      return {
        success: false,
        error: 'Meta WhatsApp Cloud API timeout (HTTP 504 Gateway Timeout)'
      };
    }

    const randomHex = crypto.randomBytes(8).toString('hex').toUpperCase();
    const providerMsgId = `WAMID-2026-${randomHex}`;

    return {
      success: true,
      providerMsgId
    };
  }

  /**
   * Reschedules the event for retry with exponential backoff
   */
  private async handleRetry(event: any, errorMessage: string): Promise<void> {
    const nextRetryCount = event.retryCount + 1;
    const backoffSeconds = Math.min(Math.pow(2, nextRetryCount) * 2, 60);
    const nextRetryAt = new Date(Date.now() + backoffSeconds * 1000);

    await prisma.outbox.update({
      where: { id: event.id },
      data: {
        status: OutboxStatus.PENDING,
        retryCount: nextRetryCount,
        nextRetryAt,
        errorMessage
      }
    });

    if (event.eventType === 'CERTIFICATE_ISSUED') {
      await prisma.deliveryLog.updateMany({
        where: { certificateId: event.aggregateId },
        data: {
          errorMessage: `Retry attempt #${nextRetryCount}. Error: ${errorMessage}`
        }
      });
    }
  }
}

export const outboxWorker = new OutboxWorker();
