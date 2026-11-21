import { Router } from 'express';
import { outboxController } from '../controllers/outbox.controller.js';
import { authenticate } from '../middlewares/auth.middleware.js';

const router = Router();

// Require authentication for administrative outbox endpoints
router.use(authenticate);

// 1. POST /api/v1/outbox/process - Unified processor for ALL outbox events (Batches + WhatsApp)
router.post(
  '/process',
  (req, res) => outboxController.processAllOutboxEvents(req, res)
);

// 2. GET /api/v1/outbox/status - Outbox queue counters & breakdown
router.get(
  '/status',
  (req, res) => outboxController.getOutboxStatus(req, res)
);

export default router;
