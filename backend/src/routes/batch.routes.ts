import { Router } from 'express';
import { Role } from '@prisma/client';
import { batchController } from '../controllers/batch.controller.js';
import { authenticate, requireRole } from '../middlewares/auth.middleware.js';
import { uploadSpreadsheet } from '../middlewares/upload.middleware.js';
import {
  batchIdParamValidator,
  paginationQueryValidator,
  createAndSubmitBatchValidator,
  resubmitBatchValidator
} from '../validators/batch.validator.js';

const router = Router();

// All batch routes require authentication
router.use(authenticate);

// 1. POST /api/v1/batches - Create batch + candidates and submit for review (Training Centre)
router.post(
  '/',
  requireRole([Role.TRAINING_CENTRE]),
  uploadSpreadsheet.single('file'),
  createAndSubmitBatchValidator,
  (req, res) => batchController.createAndSubmitBatch(req, res)
);

// 2. GET /api/v1/batches - View my batches with pagination (Training Centre)
router.get(
  '/',
  requireRole([Role.TRAINING_CENTRE]),
  paginationQueryValidator,
  (req, res) => batchController.getMyBatches(req, res)
);

// 3. GET /api/v1/batches/:id - View batch details, candidates, and approval history
router.get(
  '/:id',
  batchIdParamValidator,
  (req, res) => batchController.getBatchById(req, res)
);

// 4. PUT /api/v1/batches/:id - Fix and resubmit returned batch (Training Centre)
router.put(
  '/:id',
  requireRole([Role.TRAINING_CENTRE]),
  uploadSpreadsheet.single('file'),
  resubmitBatchValidator,
  (req, res) => batchController.resubmitBatch(req, res)
);

export default router;
