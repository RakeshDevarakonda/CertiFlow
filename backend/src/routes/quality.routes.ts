import { Router } from 'express';
import { Role } from '@prisma/client';
import { qualityController } from '../controllers/quality.controller.js';
import { authenticate, requireRole } from '../middlewares/auth.middleware.js';
import { paginationQueryValidator } from '../validators/batch.validator.js';
import {
  qualityDecisionValidator,
  qualityReasonValidator,
  batchIdParamValidator
} from '../validators/quality.validator.js';

const router = Router();

// All quality routes require authentication & QUALITY_OFFICER role
router.use(authenticate);
router.use(requireRole([Role.QUALITY_OFFICER]));

// 1. GET /api/v1/quality/batches/pending - Batches awaiting quality scrutiny
router.get(
  '/batches/pending',
  paginationQueryValidator,
  (req, res) => qualityController.getPendingBatches(req, res)
);

// 2. POST /api/v1/quality/batches/:id/approve - Approve batch -> Promotes to STATE_PENDING
router.post(
  '/batches/:id/approve',
  batchIdParamValidator,
  (req, res) => qualityController.approveBatch(req, res)
);

// 3. POST /api/v1/quality/batches/:id/return - Return batch for corrections (requires comment)
router.post(
  '/batches/:id/return',
  qualityReasonValidator,
  (req, res) => qualityController.returnBatch(req, res)
);

// 4. POST /api/v1/quality/batches/:id/reject - Reject batch permanently (requires comment)
router.post(
  '/batches/:id/reject',
  qualityReasonValidator,
  (req, res) => qualityController.rejectBatch(req, res)
);

// 5. POST /api/v1/quality/batches/:id/decision - Unified Decision Engine
router.post(
  '/batches/:id/decision',
  qualityDecisionValidator,
  (req, res) => qualityController.recordDecision(req, res)
);

export default router;
