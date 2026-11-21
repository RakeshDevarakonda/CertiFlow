import * as XLSX from 'xlsx';
import { BatchStatus } from '@prisma/client';
import { prisma } from '../config/db.js';

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

  // Parse and validate spreadsheet rows atomically (Moment 1 safety)
  parseAndValidateSpreadsheet(fileBuffer: Buffer): { fullName: string; phoneNumber: string; email?: string }[] {
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
          message: 'Phone number is required.'
        });
      } else if (!phoneRegex.test(cleanPhone)) {
        errors.push({
          row: rowNumber,
          field: 'phoneNumber',
          value: phone,
          message: 'Invalid Indian phone number format (must be 10 digits starting with 6-9).'
        });
      } else {
        const standardizedPhone = cleanPhone.startsWith('+91')
          ? cleanPhone
          : cleanPhone.startsWith('91') && cleanPhone.length === 12
          ? `+${cleanPhone}`
          : `+91${cleanPhone}`;

        if (seenPhonesInFile.has(standardizedPhone)) {
          errors.push({
            row: rowNumber,
            field: 'phoneNumber',
            value: phone,
            message: `Duplicate phone number within the spreadsheet: ${phone}`
          });
        } else {
          seenPhonesInFile.add(standardizedPhone);
          phone = standardizedPhone;
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

    if (errors.length > 0) {
      throw new BatchUploadValidationError(errors);
    }

    return validCandidates;
  }

  // 1. POST /api/v1/batches - Create batch + candidates and submit for review
  async createAndSubmitBatch(centreId: string, courseName: string, fileBuffer: Buffer, actorId: string) {
    const centre = await prisma.trainingCentre.findUnique({
      where: { id: centreId }
    });

    if (!centre) {
      throw new Error('Training centre not found.');
    }

    const validCandidates = this.parseAndValidateSpreadsheet(fileBuffer);
    const batchNumber = this.generateBatchNumber(centre.code);

    const batch = await prisma.$transaction(async (tx) => {
      const created = await tx.batch.create({
        data: {
          batchNumber,
          centreId,
          courseName: courseName.trim(),
          status: BatchStatus.DISTRICT_PENDING,
          candidateCount: validCandidates.length,
          approvalRound: 1,
          submittedAt: new Date(),
          lastActivityAt: new Date()
        }
      });

      await tx.candidate.createMany({
        data: validCandidates.map(c => ({
          batchId: created.id,
          fullName: c.fullName,
          phoneNumber: c.phoneNumber,
          email: c.email || null
        }))
      });

      await tx.auditLog.create({
        data: {
          entityType: 'BATCH',
          entityId: created.id,
          actorId,
          action: 'BATCH_CREATED_AND_SUBMITTED',
          metadata: {
            batchNumber,
            courseName: created.courseName,
            status: BatchStatus.DISTRICT_PENDING,
            candidateCount: validCandidates.length
          }
        }
      });

      return created;
    });

    return {
      batch,
      totalCandidates: validCandidates.length
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
            orderBy: { createdAt: 'desc' },
            take: 5,
            include: {
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

  // 3. GET /api/v1/batches/:id - Get batch details, candidates, and approvals history
  async getBatchById(batchId: string, centreId?: string) {
    const batch = await prisma.batch.findUnique({
      where: { id: batchId },
      include: {
        centre: true,
        candidates: {
          orderBy: { createdAt: 'asc' }
        },
        approvals: {
          orderBy: { createdAt: 'asc' },
          include: {
            officer: {
              select: { id: true, name: true, role: true, district: true }
            }
          }
        }
      }
    });

    if (!batch) {
      throw new Error('Batch not found.');
    }

    if (centreId && batch.centreId !== centreId) {
      throw new Error('Forbidden. You do not have permission to view this batch.');
    }

    return batch;
  }

  // 4. PUT /api/v1/batches/:id - Fix and resubmit returned batch with corrected spreadsheet (Moment 6)
  async resubmitBatch(
    batchId: string,
    centreId: string,
    actorId: string,
    fileBuffer?: Buffer,
    courseName?: string
  ) {
    const batch = await prisma.batch.findUnique({
      where: { id: batchId }
    });

    if (!batch) {
      throw new Error('Batch not found.');
    }

    if (batch.centreId !== centreId) {
      throw new Error('Forbidden. You do not own this batch.');
    }

    if (batch.status !== BatchStatus.RETURNED) {
      throw new Error(`Only RETURNED batches can be resubmitted. Current status: ${batch.status}`);
    }

    // Parse new spreadsheet if provided
    let newCandidates: { fullName: string; phoneNumber: string; email?: string }[] | null = null;
    if (fileBuffer) {
      newCandidates = this.parseAndValidateSpreadsheet(fileBuffer);
    }

    const nextRound = batch.approvalRound + 1;

    const updated = await prisma.$transaction(async (tx) => {
      // Replace candidates if new file provided
      if (newCandidates) {
        await tx.candidate.deleteMany({ where: { batchId } });
        await tx.candidate.createMany({
          data: newCandidates.map(c => ({
            batchId,
            fullName: c.fullName,
            phoneNumber: c.phoneNumber,
            email: c.email || null
          }))
        });
      }

      const b = await tx.batch.update({
        where: { id: batchId },
        data: {
          status: BatchStatus.DISTRICT_PENDING,
          approvalRound: nextRound,
          courseName: courseName ? courseName.trim() : batch.courseName,
          candidateCount: newCandidates ? newCandidates.length : batch.candidateCount,
          lastActivityAt: new Date()
        }
      });

      await tx.auditLog.create({
        data: {
          entityType: 'BATCH',
          entityId: batchId,
          actorId,
          action: 'BATCH_RESUBMITTED',
          metadata: {
            status: BatchStatus.DISTRICT_PENDING,
            approvalRound: nextRound,
            candidatesReplaced: !!newCandidates,
            candidateCount: b.candidateCount
          }
        }
      });

      return b;
    });

    return {
      batch: updated,
      message: `Batch resubmitted for district review successfully (Round ${nextRound}).`
    };
  }
}

export const batchService = new BatchService();
