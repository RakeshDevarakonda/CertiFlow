import { Router } from 'express';
import { Role } from '@prisma/client';
import { districtController } from '../controllers/district.controller.js';
import { authenticate, requireRole } from '../middlewares/auth.middleware.js';
import { paginationQueryValidator } from '../validators/batch.validator.js';
import {
  districtDecisionValidator,
  districtReasonValidator,
  batchIdParamValidator
} from '../validators/district.validator.js';

const router = Router();

// All district officer routes require authentication & DISTRICT_OFFICER role
router.use(authenticate);
router.use(requireRole([Role.DISTRICT_OFFICER]));

// 1. GET /api/v1/district/batches/pending - List batches awaiting district review
router.get(
  '/batches/pending',
  paginationQueryValidator,
  (req, res) => districtController.getPendingBatches(req, res)
);

// 1.1 GET /api/v1/district/batches/approved-by-me - List all batches approved by this officer
router.get(
  '/batches/approved-by-me',
  paginationQueryValidator,
  (req, res) => districtController.getApprovedByMeBatches(req, res)
);

// 2. POST /api/v1/district/batches/:id/approve - Approve batch (Quorum of 2)
router.post(
  '/batches/:id/approve',
  batchIdParamValidator,
  (req, res) => districtController.approveBatch(req, res)
);

// 3. POST /api/v1/district/batches/:id/return - Return batch for correction (requires comment)
router.post(
  '/batches/:id/return',
  districtReasonValidator,
  (req, res) => districtController.returnBatch(req, res)
);

// 4. POST /api/v1/district/batches/:id/reject - Reject batch permanently (requires comment)
router.post(
  '/batches/:id/reject',
  districtReasonValidator,
  (req, res) => districtController.rejectBatch(req, res)
);

// 5. POST /api/v1/district/batches/:id/decision - Unified Decision Engine
router.post(
  '/batches/:id/decision',
  districtDecisionValidator,
  (req, res) => districtController.recordDecision(req, res)
);

export default router;
