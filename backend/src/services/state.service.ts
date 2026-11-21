import {
  BatchStatus,
  ApprovalStage,
  ApprovalAction,
  CertificateStatus,
  OutboxStatus
} from '@prisma/client';
import { prisma } from '../config/db.js';
import { CertificateGenerator } from '../utils/certificate.generator.js';

export class StateService {
  // 1. GET /api/v1/state/batches/pending - Batches awaiting final state approval
  async getPendingStateBatches(page: number = 1, limit: number = 10) {
    const skip = (page - 1) * limit;

    const whereClause = {
      status: BatchStatus.STATE_PENDING
    };

    const [total, batches] = await prisma.$transaction([
      prisma.batch.count({ where: whereClause }),
      prisma.batch.findMany({
        where: whereClause,
        skip,
        take: limit,
        orderBy: { submittedAt: 'asc' }, // FIFO
        include: {
          centre: {
            select: { id: true, name: true, code: true, district: true, state: true }
          },
          approvals: {
            include: {
              officer: {
                select: { id: true, name: true, email: true, role: true, district: true }
              }
            },
            orderBy: { createdAt: 'desc' }
          }
        }
      })
    ]);

    const formattedBatches = batches.map((batch) => {
      const currentApprovals = batch.approvals.filter(
        (a) => a.approvalRound === batch.approvalRound
      );

      return {
        id: batch.id,
        batchNumber: batch.batchNumber,
        courseName: batch.courseName,
        status: batch.status,
        candidateCount: batch.candidateCount,
        approvalRound: batch.approvalRound,
        submittedAt: batch.submittedAt,
        lastActivityAt: batch.lastActivityAt,
        centre: batch.centre,
        reviewHistory: currentApprovals.map((a) => ({
          officerName: a.officer.name,
          role: a.officer.role,
          district: a.officer.district,
          stage: a.stage,
          action: a.action,
          comment: a.comment,
          createdAt: a.createdAt
        }))
      };
    });

    const totalPages = Math.ceil(total / limit);

    return {
      batches: formattedBatches,
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

  // 2. Final Approval & Certificate Issuance Engine (Moment 3)
  async approveBatchAndIssueCertificates(
    batchId: string,
    stateOfficerId: string,
    comment?: string
  ) {
    const result = await prisma.$transaction(async (tx) => {
      const batch = await tx.batch.findUnique({
        where: { id: batchId },
        include: {
          candidates: true,
          centre: true
        }
      });

      if (!batch) {
        throw new Error('Batch not found.');
      }

      if (batch.status !== BatchStatus.STATE_PENDING) {
        throw new Error(
          `Batch is not awaiting state office approval. Current status: ${batch.status}`
        );
      }

      // Check if state officer already approved this round
      const existingVote = await tx.batchApproval.findFirst({
        where: {
          batchId,
          officerId: stateOfficerId,
          stage: ApprovalStage.STATE,
          approvalRound: batch.approvalRound
        }
      });

      if (existingVote) {
        throw new Error(
          'You have already recorded a decision for this batch in the current approval round.'
        );
      }

      // Record State Office Approval in audit ledger
      await tx.batchApproval.create({
        data: {
          batchId,
          officerId: stateOfficerId,
          stage: ApprovalStage.STATE,
          action: ApprovalAction.APPROVED,
          approvalRound: batch.approvalRound,
          comment: comment ? comment.trim() : 'Final state sign-off granted.'
        }
      });

      // Update Batch Status to APPROVED
      const updatedBatch = await tx.batch.update({
        where: { id: batchId },
        data: {
          status: BatchStatus.APPROVED,
          lastActivityAt: new Date()
        }
      });

      // Generate & Issue Certificates for every candidate in batch
      const issuedCertificates = [];
      for (const candidate of batch.candidates) {
        const certData = CertificateGenerator.generateForCandidate(
          candidate.id,
          candidate.fullName,
          batch.id,
          batch.courseName
        );

        const cert = await tx.certificate.create({
          data: {
            certificateNumber: certData.certificateNumber,
            candidateId: candidate.id,
            batchId: batch.id,
            verificationCode: certData.verificationCode,
            pdfStoragePath: certData.pdfStoragePath,
            pdfHash: certData.pdfHash,
            status: CertificateStatus.ISSUED
          }
        });

        // ---------------------------------------------------------
        // TRANSACTIONAL OUTBOX: Atomically record delivery event
        // Strict Idempotency Key ensures no duplicate event can ever be queued
        // ---------------------------------------------------------
        const idempotencyKey = `WHATSAPP_DELIVERY:${cert.id}`;

        await tx.outbox.create({
          data: {
            idempotencyKey,
            aggregateType: 'CERTIFICATE',
            aggregateId: cert.id,
            eventType: 'CERTIFICATE_ISSUED',
            payload: {
              certificateId: cert.id,
              certificateNumber: cert.certificateNumber,
              verificationCode: cert.verificationCode,
              candidateName: candidate.fullName,
              phoneNumber: candidate.phoneNumber,
              courseName: batch.courseName,
              centreName: batch.centre.name
            },
            status: OutboxStatus.PENDING
          }
        });

        issuedCertificates.push({
          id: cert.id,
          certificateNumber: cert.certificateNumber,
          verificationCode: cert.verificationCode,
          candidateName: candidate.fullName,
          candidatePhone: candidate.phoneNumber
        });
      }

      // Audit Log
      await tx.auditLog.create({
        data: {
          entityType: 'BATCH',
          entityId: batchId,
          actorId: stateOfficerId,
          action: 'STATE_FINAL_APPROVED_AND_ISSUED',
          metadata: {
            batchNumber: batch.batchNumber,
            totalIssued: issuedCertificates.length,
            approvalRound: batch.approvalRound
          }
        }
      });

      return {
        batch: updatedBatch,
        certificatesIssued: issuedCertificates.length,
        certificates: issuedCertificates,
        message: `Batch ${batch.batchNumber} approved. ${issuedCertificates.length} certificates issued and queued for WhatsApp delivery.`
      };
    });

    return result;
  }

  // 3. Return Batch for corrections
  async returnBatch(batchId: string, stateOfficerId: string, comment: string) {
    const result = await prisma.$transaction(async (tx) => {
      const batch = await tx.batch.findUnique({ where: { id: batchId } });

      if (!batch) {
        throw new Error('Batch not found.');
      }

      if (batch.status !== BatchStatus.STATE_PENDING) {
        throw new Error(
          `Batch is not awaiting state office approval. Current status: ${batch.status}`
        );
      }

      // Record return
      await tx.batchApproval.create({
        data: {
          batchId,
          officerId: stateOfficerId,
          stage: ApprovalStage.STATE,
          action: ApprovalAction.RETURNED,
          approvalRound: batch.approvalRound,
          comment: comment.trim()
        }
      });

      // Update batch to RETURNED
      const updated = await tx.batch.update({
        where: { id: batchId },
        data: {
          status: BatchStatus.RETURNED,
          lastActivityAt: new Date()
        }
      });

      // Audit Log
      await tx.auditLog.create({
        data: {
          entityType: 'BATCH',
          entityId: batchId,
          actorId: stateOfficerId,
          action: 'STATE_STAGE_RETURNED',
          metadata: {
            reason: comment.trim(),
            approvalRound: batch.approvalRound
          }
        }
      });

      return {
        batchId,
        action: ApprovalAction.RETURNED,
        status: updated.status,
        message: 'Batch returned to training centre for corrections.'
      };
    });

    return result;
  }

  // 4. Reject Batch permanently
  async rejectBatch(batchId: string, stateOfficerId: string, comment: string) {
    const result = await prisma.$transaction(async (tx) => {
      const batch = await tx.batch.findUnique({ where: { id: batchId } });

      if (!batch) {
        throw new Error('Batch not found.');
      }

      if (batch.status !== BatchStatus.STATE_PENDING) {
        throw new Error(
          `Batch is not awaiting state office approval. Current status: ${batch.status}`
        );
      }

      // Record reject
      await tx.batchApproval.create({
        data: {
          batchId,
          officerId: stateOfficerId,
          stage: ApprovalStage.STATE,
          action: ApprovalAction.REJECTED,
          approvalRound: batch.approvalRound,
          comment: comment.trim()
        }
      });

      // Update batch to REJECTED
      const updated = await tx.batch.update({
        where: { id: batchId },
        data: {
          status: BatchStatus.REJECTED,
          lastActivityAt: new Date()
        }
      });

      // Audit Log
      await tx.auditLog.create({
        data: {
          entityType: 'BATCH',
          entityId: batchId,
          actorId: stateOfficerId,
          action: 'STATE_STAGE_REJECTED',
          metadata: {
            reason: comment.trim(),
            approvalRound: batch.approvalRound
          }
        }
      });

      return {
        batchId,
        action: ApprovalAction.REJECTED,
        status: updated.status,
        message: 'Batch permanently rejected by State Office.'
      };
    });

    return result;
  }

  // 5. Cancel an Issued Certificate (Moment 4)
  async cancelCertificate(
    certificateId: string,
    stateOfficerId: string,
    reason: string
  ) {
    const result = await prisma.$transaction(async (tx) => {
      const cert = await tx.certificate.findUnique({
        where: { id: certificateId },
        include: {
          candidate: true,
          batch: true
        }
      });

      if (!cert) {
        throw new Error('Certificate not found.');
      }

      if (cert.status === CertificateStatus.CANCELLED) {
        throw new Error('Certificate is already cancelled.');
      }

      // Update certificate status
      const updatedCert = await tx.certificate.update({
        where: { id: certificateId },
        data: {
          status: CertificateStatus.CANCELLED,
          cancellationReason: reason.trim(),
          cancelledAt: new Date(),
          cancelledById: stateOfficerId
        }
      });

      // Audit Log
      await tx.auditLog.create({
        data: {
          entityType: 'CERTIFICATE',
          entityId: certificateId,
          actorId: stateOfficerId,
          action: 'CERTIFICATE_CANCELLED',
          metadata: {
            certificateNumber: cert.certificateNumber,
            verificationCode: cert.verificationCode,
            candidateName: cert.candidate.fullName,
            reason: reason.trim()
          }
        }
      });

      return {
        certificate: updatedCert,
        message: `Certificate ${cert.certificateNumber} has been officially cancelled.`
      };
    });

    // Invalidate public verification cache if Redis is configured
    try {
      const { verifyService } = await import('./verify.service.js');
      await verifyService.invalidateCache(result.certificate.verificationCode);
    } catch {
      // Ignore cache invalidation failures
    }

    return result;
  }

  // 6. SLA Breach & Stuck Batches Monitoring (Moment 5)
  async getStuckBatches(thresholdHours: number = 48, page: number = 1, limit: number = 10) {
    const skip = (page - 1) * limit;
    const thresholdDate = new Date(Date.now() - thresholdHours * 60 * 60 * 1000);

    const whereClause = {
      status: {
        in: [BatchStatus.DISTRICT_PENDING, BatchStatus.QUALITY_PENDING, BatchStatus.STATE_PENDING]
      },
      lastActivityAt: {
        lt: thresholdDate
      }
    };

    const [total, batches] = await prisma.$transaction([
      prisma.batch.count({ where: whereClause }),
      prisma.batch.findMany({
        where: whereClause,
        skip,
        take: limit,
        orderBy: { lastActivityAt: 'asc' }, // Most severely delayed first
        include: {
          centre: {
            select: { id: true, name: true, code: true, district: true, state: true }
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
      })
    ]);

    const formatted = batches.map((b) => {
      const hoursInactive = Math.round(
        (Date.now() - new Date(b.lastActivityAt).getTime()) / (1000 * 60 * 60)
      );

      return {
        id: b.id,
        batchNumber: b.batchNumber,
        courseName: b.courseName,
        status: b.status,
        candidateCount: b.candidateCount,
        approvalRound: b.approvalRound,
        submittedAt: b.submittedAt,
        lastActivityAt: b.lastActivityAt,
        hoursInactive,
        breachedByHours: hoursInactive - thresholdHours,
        centre: b.centre,
        lastApprovalAction: b.approvals[0]
          ? {
              officer: b.approvals[0].officer.name,
              stage: b.approvals[0].stage,
              action: b.approvals[0].action,
              date: b.approvals[0].createdAt
            }
          : null
      };
    });

    const totalPages = Math.ceil(total / limit);

    return {
      thresholdHours,
      totalBreached: total,
      batches: formatted,
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
}

export const stateService = new StateService();
