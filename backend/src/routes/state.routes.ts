import { Router } from 'express';
import { Role } from '@prisma/client';
import { stateController } from '../controllers/state.controller.js';
import { authenticate, requireRole } from '../middlewares/auth.middleware.js';
import { paginationQueryValidator } from '../validators/batch.validator.js';
import {
  batchIdParamValidator,
  stateReasonValidator,
  cancelCertificateValidator
} from '../validators/state.validator.js';

const router = Router();

// All state routes require authentication & STATE_OFFICE role
router.use(authenticate);
router.use(requireRole([Role.STATE_OFFICE]));

// 1. GET /api/v1/state/batches/pending - List batches awaiting final state approval
router.get(
  '/batches/pending',
  paginationQueryValidator,
  (req, res) => stateController.getPendingBatches(req, res)
);

// 2. POST /api/v1/state/batches/:id/approve - Give final approval & issue certificates
router.post(
  '/batches/:id/approve',
  batchIdParamValidator,
  (req, res) => stateController.approveBatch(req, res)
);

// 3. POST /api/v1/state/batches/:id/return - Return batch for corrections
router.post(
  '/batches/:id/return',
  stateReasonValidator,
  (req, res) => stateController.returnBatch(req, res)
);

// 4. POST /api/v1/state/batches/:id/reject - Reject batch permanently
router.post(
  '/batches/:id/reject',
  stateReasonValidator,
  (req, res) => stateController.rejectBatch(req, res)
);

// 5. POST /api/v1/state/certificates/:id/cancel - Cancel an issued certificate
router.post(
  '/certificates/:id/cancel',
  cancelCertificateValidator,
  (req, res) => stateController.cancelCertificate(req, res)
);

export default router;
