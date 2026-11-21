import * as XLSX from 'xlsx';
import { BatchStatus, OutboxStatus } from '@prisma/client';
import { prisma } from '../config/db.js';
import { outboxWorker } from './outbox.service.js';

export interface RowValidationError {
  row: number;
  field: string;
  value: any;
  message: string;
}

export class BatchUploadValidationError extends Error {
  public errors: RowValidationError[];

  constructor(errors: RowValidationError[]) {
    super(`Validation failed on ${errors.length} rows. No candidates were saved.`);
    this.name = 'BatchUploadValidationError';
    this.errors = errors;
  }
}

export class BatchService {
  private generateBatchNumber(centreCode: string): string {
    const randomSuffix = Math.random().toString(36).substring(2, 6).toUpperCase();
    return `BATCH-${new Date().getFullYear()}-${centreCode}-${randomSuffix}`;
  }

  // Parse raw spreadsheet rows into JSON
  parseSpreadsheetRaw(fileBuffer: Buffer): any[] {
    const workbook = XLSX.read(fileBuffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    if (!sheetName) {
      throw new Error('Spreadsheet contains no sheets.');
    }

    const sheet = workbook.Sheets[sheetName];
    const rawRows: any[] = XLSX.utils.sheet_to_json(sheet, { defval: '' });

    if (rawRows.length === 0) {
      throw new Error('The uploaded spreadsheet is empty. Please include candidate rows.');
    }

    return rawRows;
  }

  // Row-level validator (Moment 1 safety)
  validateRows(rawRows: any[]): { valid: { fullName: string; phoneNumber: string; email?: string }[]; errors: RowValidationError[] } {
    const errors: RowValidationError[] = [];
    const validCandidates: { fullName: string; phoneNumber: string; email?: string }[] = [];
    const seenPhonesInFile = new Set<string>();

    const phoneRegex = /^(?:\+91|91)?[6-9]\d{9}$/;
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    rawRows.forEach((row, index) => {
      const rowNumber = index + 2;

      const fullName = (row['Full Name'] || row['fullName'] || row['name'] || row['Name'] || '').toString().trim();
      let phone = (row['Phone Number'] || row['phoneNumber'] || row['Phone'] || row['phone'] || row['Mobile'] || '').toString().trim();
      const email = (row['Email'] || row['email'] || '').toString().trim();

      const cleanPhone = phone.replace(/[\s-]/g, '');

      if (!fullName) {
        errors.push({
          row: rowNumber,
          field: 'fullName',
          value: fullName,
          message: 'Candidate full name is required.'
        });
      } else if (fullName.length < 2) {
        errors.push({
          row: rowNumber,
          field: 'fullName',
          value: fullName,
          message: 'Candidate full name must be at least 2 characters.'
        });
      }

      if (!cleanPhone) {
        errors.push({
          row: rowNumber,
          field: 'phoneNumber',
          value: phone,
          message: 'Candidate phone number is required.'
        });
      } else if (!phoneRegex.test(cleanPhone)) {
        errors.push({
          row: rowNumber,
          field: 'phoneNumber',
          value: phone,
          message: 'Invalid Indian phone number format (must be 10 digits starting with 6-9).'
        });
      } else {
        const standardPhone = cleanPhone.length === 10 ? `+91${cleanPhone}` : (cleanPhone.startsWith('+') ? cleanPhone : `+${cleanPhone}`);
        if (seenPhonesInFile.has(standardPhone)) {
          errors.push({
            row: rowNumber,
            field: 'phoneNumber',
            value: phone,
            message: `Duplicate phone number "${phone}" found in file.`
          });
        } else {
          seenPhonesInFile.add(standardPhone);
          phone = standardPhone;
        }
      }

      if (email && !emailRegex.test(email)) {
        errors.push({
          row: rowNumber,
          field: 'email',
          value: email,
          message: 'Invalid email address format.'
        });
      }

      if (errors.length === 0 || !errors.some(e => e.row === rowNumber)) {
        validCandidates.push({
          fullName,
          phoneNumber: phone,
          email: email || undefined
        });
      }
    });

    return { valid: validCandidates, errors };
  }

  // 1. POST /api/v1/batches - Asynchronous Upload via Transactional Outbox
  async createAndSubmitBatch(centreId: string, courseName: string, fileBuffer: Buffer, actorId: string) {
    const centre = await prisma.trainingCentre.findUnique({
      where: { id: centreId }
    });

    if (!centre) {
      throw new Error('Training centre not found.');
    }

    const rawRows = this.parseSpreadsheetRaw(fileBuffer);
    const batchNumber = this.generateBatchNumber(centre.code);

    // Atomically create batch in VALIDATING status + enqueue Outbox validation job
    const batch = await prisma.$transaction(async (tx) => {
      const created = await tx.batch.create({
        data: {
          batchNumber,
          centreId,
          courseName: courseName.trim(),
          status: BatchStatus.VALIDATING,
          candidateCount: rawRows.length,
          approvalRound: 1,
          submittedAt: new Date(),
          lastActivityAt: new Date()
        }
      });

      // Transactional Outbox Job: BATCH_VALIDATION
      const idempotencyKey = `BATCH_VALIDATION:${created.id}`;

      await tx.outbox.create({
        data: {
          idempotencyKey,
          aggregateType: 'BATCH',
          aggregateId: created.id,
          eventType: 'BATCH_VALIDATION',
          payload: {
            batchId: created.id,
            actorId,
            rawRows
          },
          status: OutboxStatus.PENDING
        }
      });

      await tx.auditLog.create({
        data: {
          entityType: 'BATCH',
          entityId: created.id,
          actorId,
          action: 'BATCH_UPLOADED_FOR_ASYNC_VALIDATION',
          metadata: {
            batchNumber,
            courseName: created.courseName,
            status: BatchStatus.VALIDATING,
            totalRows: rawRows.length
          }
        }
      });

      return created;
    });

    // Asynchronously trigger outbox worker to process validation without blocking HTTP response
    setImmediate(() => {
      outboxWorker.pollAndProcess().catch(console.error);
    });

    return {
      batch,
      totalRows: rawRows.length,
      message: `Batch ${batch.batchNumber} received. Asynchronous outbox worker validating ${rawRows.length} candidates.`
    };
  }

  // 2. GET /api/v1/batches - Get batches belonging to the logged-in centre (paginated)
  async getCentreBatches(centreId: string, page: number = 1, limit: number = 10) {
    const skip = (page - 1) * limit;

    const [total, batches] = await prisma.$transaction([
      prisma.batch.count({ where: { centreId } }),
      prisma.batch.findMany({
        where: { centreId },
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          _count: {
            select: { candidates: true }
          },
          approvals: {
            select: {
              id: true,
              stage: true,
              action: true,
              approvalRound: true,
              comment: true,
              createdAt: true,
              officer: {
                select: { id: true, name: true, role: true }
              }
            }
          }
        }
      })
    ]);

    const totalPages = Math.ceil(total / limit);

    return {
      batches,
      pagination: {
        total,
        page,
        limit,
        totalPages,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1
      }
    };
  }

  // 3. GET /api/v1/batches/:id - Get batch details
  async getBatchById(batchId: string, centreId?: string) {
    const whereClause: any = { id: batchId };
    if (centreId) {
      whereClause.centreId = centreId;
    }

    const batch = await prisma.batch.findFirst({
      where: whereClause,
      include: {
        centre: {
          select: { id: true, name: true, code: true, district: true, state: true }
        },
        candidates: {
          take: 10,
          select: { id: true, fullName: true, phoneNumber: true, email: true }
        },
        approvals: {
          include: {
            officer: {
              select: { id: true, name: true, role: true, district: true }
            }
          },
          orderBy: { createdAt: 'desc' }
        }
      }
    });

    if (!batch) {
      throw new Error('Batch not found or unauthorized.');
    }

    return batch;
  }

  // 4. GET /api/v1/batches/:id/candidates - Standalone candidate listing
  async getCandidates(batchId: string, page: number = 1, limit: number = 20, centreId?: string) {
    if (centreId) {
      const owns = await prisma.batch.findFirst({
        where: { id: batchId, centreId }
      });
      if (!owns) {
        throw new Error('Forbidden. You do not own this batch.');
      }
    }

    const skip = (page - 1) * limit;

    const [total, candidates] = await prisma.$transaction([
      prisma.candidate.count({ where: { batchId } }),
      prisma.candidate.findMany({
        where: { batchId },
        skip,
        take: limit,
        orderBy: { createdAt: 'asc' },
        select: {
          id: true,
          fullName: true,
          phoneNumber: true,
          email: true,
          createdAt: true
        }
      })
    ]);

    const totalPages = Math.ceil(total / limit);

    return {
      candidates,
      pagination: {
        total,
        page,
        limit,
        totalPages,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1
      }
    };
  }

  // 5. PUT /api/v1/batches/:id - Fix and resubmit returned batch (Moment 6)
  async resubmitBatch(
    batchId: string,
    centreId: string,
    actorId: string,
    fileBuffer?: Buffer,
    courseName?: string
  ) {
    const existing = await prisma.batch.findFirst({
      where: { id: batchId, centreId }
    });

    if (!existing) {
      throw new Error('Batch not found or does not belong to your centre.');
    }

    if (existing.status !== BatchStatus.RETURNED && existing.status !== BatchStatus.VALIDATION_FAILED) {
      throw new Error(
        `Only RETURNED or VALIDATION_FAILED batches can be fixed and resubmitted. Current status: ${existing.status}`
      );
    }

    let rawRows: any[] | null = null;
    if (fileBuffer) {
      rawRows = this.parseSpreadsheetRaw(fileBuffer);
    }

    const result = await prisma.$transaction(async (tx) => {
      const nextRound = existing.approvalRound + 1;

      const updated = await tx.batch.update({
        where: { id: batchId },
        data: {
          courseName: courseName ? courseName.trim() : existing.courseName,
          status: fileBuffer ? BatchStatus.VALIDATING : BatchStatus.DISTRICT_PENDING,
          candidateCount: rawRows ? rawRows.length : existing.candidateCount,
          approvalRound: nextRound,
          validationErrors: undefined,
          submittedAt: new Date(),
          lastActivityAt: new Date()
        }
      });

      if (rawRows && fileBuffer) {
        // Enqueue async validation job
        const idempotencyKey = `BATCH_RESUBMIT_VALIDATION:${batchId}:ROUND_${nextRound}`;
        await tx.outbox.create({
          data: {
            idempotencyKey,
            aggregateType: 'BATCH',
            aggregateId: batchId,
            eventType: 'BATCH_VALIDATION',
            payload: {
              batchId,
              actorId,
              rawRows,
              isResubmit: true
            },
            status: OutboxStatus.PENDING
          }
        });
      }

      await tx.auditLog.create({
        data: {
          entityType: 'BATCH',
          entityId: batchId,
          actorId,
          action: 'BATCH_RESUBMITTED_FOR_REVIEW',
          metadata: {
            batchNumber: existing.batchNumber,
            newApprovalRound: nextRound,
            hasNewSpreadsheet: !!fileBuffer
          }
        }
      });

      return updated;
    });

    if (fileBuffer) {
      setImmediate(() => {
        outboxWorker.pollAndProcess().catch(console.error);
      });
    }

    return {
      batch: result,
      message: `Batch ${existing.batchNumber} resubmitted for Round ${result.approvalRound} review.`
    };
  }
}

export const batchService = new BatchService();
