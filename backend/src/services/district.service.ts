import { BatchStatus, ApprovalStage, ApprovalAction } from '@prisma/client';
import { prisma } from '../config/db.js';
import { redis } from '../config/redis.js';

const DISTRICT_QUORUM_REQUIRED = 2;
const QUALITY_REVIEW_THRESHOLD = 50; // Batches with >= 50 candidates require Quality Team scrutiny

export class DistrictService {
  // 1. GET /api/v1/district/batches/pending - List batches awaiting district approval in officer's jurisdiction
  async getPendingDistrictBatches(
    officerDistrict: string,
    officerId: string,
    page: number = 1,
    limit: number = 10
  ) {
    const skip = (page - 1) * limit;

    const whereClause = {
      status: BatchStatus.DISTRICT_PENDING,
      centre: {
        district: officerDistrict
      }
    };

    const [total, batches] = await prisma.$transaction([
      prisma.batch.count({ where: whereClause }),
      prisma.batch.findMany({
        where: whereClause,
        skip,
        take: limit,
        orderBy: { submittedAt: 'asc' }, // FIFO - oldest submitted first
        include: {
          centre: {
            select: { id: true, name: true, code: true, district: true }
          },
          approvals: {
            where: { stage: ApprovalStage.DISTRICT },
            include: {
              officer: {
                select: { id: true, name: true, email: true }
              }
            }
          }
        }
      })
    ]);

    const formattedBatches = batches.map((batch) => {
      // Filter approvals matching current approvalRound
      const currentRoundApprovals = batch.approvals.filter(
        (a) => a.approvalRound === batch.approvalRound && a.action === ApprovalAction.APPROVED
      );

      const hasOfficerApproved = currentRoundApprovals.some(
        (a) => a.officerId === officerId
      );

      return {
        id: batch.id,
        batchNumber: batch.batchNumber,
        courseName: batch.courseName,
        candidateCount: batch.candidateCount,
        status: batch.status,
        approvalRound: batch.approvalRound,
        submittedAt: batch.submittedAt,
        lastActivityAt: batch.lastActivityAt,
        centre: batch.centre,
        quorumStatus: {
          approvalsCount: currentRoundApprovals.length,
          quorumRequired: DISTRICT_QUORUM_REQUIRED,
          isQuorumReached: currentRoundApprovals.length >= DISTRICT_QUORUM_REQUIRED,
          hasOfficerApproved
        },
        approvingOfficers: currentRoundApprovals.map((a) => a.officer.name)
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

  // 2. POST /api/v1/district/batches/:id/decision - Unified Decision Engine (APPROVED, RETURNED, REJECTED)
  async recordDecision(
    batchId: string,
    officerId: string,
    officerDistrict: string,
    action: ApprovalAction,
    comment?: string
  ) {
    // Acquire distributed lock on batchId to prevent concurrent race conditions (e.g. double vote at same millisecond)
    const lockKey = `lock:batch:decision:${batchId}`;
    const lockToken = await redis.acquireLock(lockKey, 5000);

    try {
      const result = await prisma.$transaction(async (tx) => {
        // A. Query batch with centre details
        const batch = await tx.batch.findUnique({
          where: { id: batchId },
          include: { centre: true }
        });

      if (!batch) {
        throw new Error('Batch not found.');
      }

      if (batch.centre.district !== officerDistrict) {
        throw new Error(
          `Forbidden. This batch belongs to district "${batch.centre.district}", but your jurisdiction is "${officerDistrict}".`
        );
      }

      if (batch.status !== BatchStatus.DISTRICT_PENDING) {
        throw new Error(
          `Batch is not awaiting district review. Current status: ${batch.status}`
        );
      }

      // B. Check if this officer has already voted in this approval round
      const existingVote = await tx.batchApproval.findFirst({
        where: {
          batchId,
          officerId,
          stage: ApprovalStage.DISTRICT,
          approvalRound: batch.approvalRound
        }
      });

      if (existingVote) {
        throw new Error(
          'You have already recorded your review for this batch in the current approval round.'
        );
      }

      // C. Handle decision based on action
      if (action === ApprovalAction.APPROVED) {
        // Record APPROVED vote
        await tx.batchApproval.create({
          data: {
            batchId,
            officerId,
            stage: ApprovalStage.DISTRICT,
            action: ApprovalAction.APPROVED,
            approvalRound: batch.approvalRound,
            comment: comment ? comment.trim() : null
          }
        });

        // Count total approvals for this batch in current round
        const totalApprovals = await tx.batchApproval.count({
          where: {
            batchId,
            stage: ApprovalStage.DISTRICT,
            action: ApprovalAction.APPROVED,
            approvalRound: batch.approvalRound
          }
        });

        let nextStatus: BatchStatus = batch.status;
        let quorumMet = false;

        // Check if Quorum of 2 distinct officers is achieved
        if (totalApprovals >= DISTRICT_QUORUM_REQUIRED) {
          quorumMet = true;

          // Big batches (>= 50 candidates) require Quality Team review; else State Office
          if (batch.candidateCount >= QUALITY_REVIEW_THRESHOLD) {
            nextStatus = BatchStatus.QUALITY_PENDING;
          } else {
            nextStatus = BatchStatus.STATE_PENDING;
          }

          await tx.batch.update({
            where: { id: batchId },
            data: {
              status: nextStatus,
              lastActivityAt: new Date()
            }
          });
        } else {
          // First approval recorded, awaiting second officer
          await tx.batch.update({
            where: { id: batchId },
            data: {
              lastActivityAt: new Date()
            }
          });
        }

        // Audit Log
        await tx.auditLog.create({
          data: {
            entityType: 'BATCH',
            entityId: batchId,
            actorId: officerId,
            action: 'DISTRICT_STAGE_APPROVED',
            metadata: {
              officerDistrict,
              approvalRound: batch.approvalRound,
              approvalsCount: totalApprovals,
              quorumRequired: DISTRICT_QUORUM_REQUIRED,
              quorumMet,
              nextStatus
            }
          }
        });

        return {
          batchId,
          action: ApprovalAction.APPROVED,
          approvalsCount: totalApprovals,
          quorumRequired: DISTRICT_QUORUM_REQUIRED,
          quorumMet,
          status: nextStatus,
          message: quorumMet
            ? `District quorum reached (${totalApprovals}/${DISTRICT_QUORUM_REQUIRED}). Batch promoted to ${nextStatus}.`
            : `Approval recorded (1/${DISTRICT_QUORUM_REQUIRED}). Awaiting second district officer approval.`
        };
      }

      if (action === ApprovalAction.RETURNED) {
        // Record RETURNED decision
        await tx.batchApproval.create({
          data: {
            batchId,
            officerId,
            stage: ApprovalStage.DISTRICT,
            action: ApprovalAction.RETURNED,
            approvalRound: batch.approvalRound,
            comment: comment!.trim()
          }
        });

        // Update batch status to RETURNED
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
            action: 'DISTRICT_STAGE_RETURNED',
            metadata: {
              reason: comment!.trim(),
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
        // Record REJECTED decision
        await tx.batchApproval.create({
          data: {
            batchId,
            officerId,
            stage: ApprovalStage.DISTRICT,
            action: ApprovalAction.REJECTED,
            approvalRound: batch.approvalRound,
            comment: comment!.trim()
          }
        });

        // Update batch status to terminal REJECTED
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
            action: 'DISTRICT_STAGE_REJECTED',
            metadata: {
              reason: comment!.trim(),
              approvalRound: batch.approvalRound
            }
          }
        });

        return {
          batchId,
          action: ApprovalAction.REJECTED,
          status: updated.status,
          message: 'Batch has been permanently rejected.'
        };
      }

      throw new Error(`Invalid decision action: ${action}`);
      });

      return result;
    } finally {
      if (lockToken) {
        await redis.releaseLock(lockKey, lockToken);
      }
    }
  }
}

export const districtService = new DistrictService();
