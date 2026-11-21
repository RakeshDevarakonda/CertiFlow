import { BatchStatus, ApprovalStage, ApprovalAction } from '@prisma/client';
import { prisma } from '../config/db.js';

export class QualityService {
  // 1. GET /api/v1/quality/batches/pending - Batches with >= 50 candidates awaiting quality review
  async getPendingQualityBatches(_officerId: string, page: number = 1, limit: number = 10) {
    const skip = (page - 1) * limit;

    const whereClause = {
      status: BatchStatus.QUALITY_PENDING
    };

    const [total, batches] = await prisma.$transaction([
      prisma.batch.count({ where: whereClause }),
      prisma.batch.findMany({
        where: whereClause,
        skip,
        take: limit,
        orderBy: { submittedAt: 'asc' }, // Oldest first
        include: {
          centre: {
            select: { id: true, name: true, code: true, district: true, state: true }
          },
          approvals: {
            include: {
              officer: {
                select: { id: true, name: true, email: true, role: true }
              }
            },
            orderBy: { createdAt: 'desc' }
          }
        }
      })
    ]);

    const formattedBatches = batches.map((batch) => {
      // Prior approvals from District officers
      const districtApprovals = batch.approvals.filter(
        (a) => a.stage === ApprovalStage.DISTRICT && a.approvalRound === batch.approvalRound
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
        districtApprovals: districtApprovals.map((a) => ({
          officerName: a.officer.name,
          action: a.action,
          createdAt: a.createdAt,
          comment: a.comment
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

  // 1.1 GET /api/v1/quality/batches/approved-by-me - Batches approved by Quality officer
  async getApprovedByMeBatches(officerId: string, page: number = 1, limit: number = 20) {
    const skip = (page - 1) * limit;

    const whereClause = {
      approvals: {
        some: {
          officerId,
          stage: ApprovalStage.QUALITY,
          action: ApprovalAction.APPROVED
        }
      }
    };

    const [total, batches] = await prisma.$transaction([
      prisma.batch.count({ where: whereClause }),
      prisma.batch.findMany({
        where: whereClause,
        skip,
        take: limit,
        orderBy: { updatedAt: 'desc' },
        include: {
          centre: {
            select: { id: true, name: true, code: true, district: true, state: true }
          },
          approvals: {
            include: {
              officer: {
                select: { id: true, name: true, email: true, role: true }
              }
            },
            orderBy: { createdAt: 'desc' }
          }
        }
      })
    ]);

    const formattedBatches = batches.map((batch) => ({
      id: batch.id,
      batchNumber: batch.batchNumber,
      courseName: batch.courseName,
      status: batch.status,
      candidateCount: batch.candidateCount,
      approvalRound: batch.approvalRound,
      submittedAt: batch.submittedAt,
      lastActivityAt: batch.lastActivityAt,
      centre: batch.centre,
      approvals: batch.approvals
    }));

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

  // 2. Decision Engine (APPROVED, RETURNED, REJECTED)
  async recordDecision(
    batchId: string,
    officerId: string,
    action: ApprovalAction,
    comment?: string
  ) {
    const result = await prisma.$transaction(async (tx) => {
      const batch = await tx.batch.findUnique({
        where: { id: batchId },
        include: { centre: true }
      });

      if (!batch) {
        throw new Error('Batch not found.');
      }

      if (batch.status !== BatchStatus.QUALITY_PENDING) {
        throw new Error(
          `Batch is not awaiting quality review. Current status: ${batch.status}`
        );
      }

      // Check if officer already recorded in this round
      const existingVote = await tx.batchApproval.findFirst({
        where: {
          batchId,
          officerId,
          stage: ApprovalStage.QUALITY,
          approvalRound: batch.approvalRound
        }
      });

      if (existingVote) {
        throw new Error(
          'You have already recorded your quality review decision for this batch in the current round.'
        );
      }

      if (action === ApprovalAction.APPROVED) {
        // Record quality approval
        await tx.batchApproval.create({
          data: {
            batchId,
            officerId,
            stage: ApprovalStage.QUALITY,
            action: ApprovalAction.APPROVED,
            approvalRound: batch.approvalRound,
            comment: comment ? comment.trim() : null
          }
        });

        // Promote to STATE_PENDING
        const updated = await tx.batch.update({
          where: { id: batchId },
          data: {
            status: BatchStatus.STATE_PENDING,
            lastActivityAt: new Date()
          }
        });

        // Audit Log
        await tx.auditLog.create({
          data: {
            entityType: 'BATCH',
            entityId: batchId,
            actorId: officerId,
            action: 'QUALITY_STAGE_APPROVED',
            metadata: {
              approvalRound: batch.approvalRound,
              nextStatus: BatchStatus.STATE_PENDING
            }
          }
        });

        return {
          batchId,
          action: ApprovalAction.APPROVED,
          status: updated.status,
          message: 'Quality scrutiny passed. Batch promoted to STATE_PENDING for final State Office approval.'
        };
      }

      if (action === ApprovalAction.RETURNED) {
        if (!comment || comment.trim().length < 5) {
          throw new Error('A reason of at least 5 characters is required when returning a batch.');
        }

        // Record returned
        await tx.batchApproval.create({
          data: {
            batchId,
            officerId,
            stage: ApprovalStage.QUALITY,
            action: ApprovalAction.RETURNED,
            approvalRound: batch.approvalRound,
            comment: comment.trim()
          }
        });

        // Update status to RETURNED
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
            actorId: officerId,
            action: 'QUALITY_STAGE_RETURNED',
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
      }

      if (action === ApprovalAction.REJECTED) {
        if (!comment || comment.trim().length < 5) {
          throw new Error('A reason of at least 5 characters is required when rejecting a batch.');
        }

        // Record rejected
        await tx.batchApproval.create({
          data: {
            batchId,
            officerId,
            stage: ApprovalStage.QUALITY,
            action: ApprovalAction.REJECTED,
            approvalRound: batch.approvalRound,
            comment: comment.trim()
          }
        });

        // Update status to REJECTED
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
            actorId: officerId,
            action: 'QUALITY_STAGE_REJECTED',
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
          message: 'Batch permanently rejected by Quality Team.'
        };
      }

      throw new Error(`Invalid action: ${action}`);
    });

    return result;
  }
}

export const qualityService = new QualityService();
