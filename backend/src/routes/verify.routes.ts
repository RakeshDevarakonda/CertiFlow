import { Router } from 'express';
import { verifyController } from '../controllers/verify.controller.js';
import { verifyCodeParamValidator } from '../validators/verify.validator.js';

const router = Router();

// =========================================================================
// PUBLIC CERTIFICATE VERIFICATION (NO AUTH REQUIRED)
// Dedicated exclusively to verifying certificate authenticity & status
// =========================================================================

// GET /api/v1/verify/:code - Zero-PII public certificate check
router.get(
  '/:code',
  verifyCodeParamValidator,
  (req, res) => verifyController.verifyCertificate(req, res)
);

export default router;
