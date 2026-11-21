import { Router } from 'express';
import { deliveryController } from '../controllers/delivery.controller.js';
import { authenticate } from '../middlewares/auth.middleware.js';

const router = Router();

// Require authentication for delivery audit endpoints
router.use(authenticate);

// 1. GET /api/v1/delivery/logs - Audit list of candidate deliveries (WhatsApp, SMS, etc.)
router.get(
  '/logs',
  (req, res) => deliveryController.getDeliveryLogs(req, res)
);

export default router;
