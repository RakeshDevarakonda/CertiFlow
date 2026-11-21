import { Router } from 'express';
import { verifyController } from '../controllers/verify.controller.js';
import { certificateController } from '../controllers/certificate.controller.js';
import { verifyCodeParamValidator } from '../validators/verify.validator.js';

const router = Router();

// =========================================================================
// PUBLIC UNRESTRICTED VERIFICATION & CERTIFICATE APIS (NO AUTH REQUIRED)
// =========================================================================

// 1. GET /api/v1/verify/:code - Verify certificate status & details (Zero PII)
router.get(
  '/:code',
  verifyCodeParamValidator,
  (req, res) => verifyController.verifyCertificate(req, res)
);

// 2. GET /api/v1/verify/:id/view - Stream inline PDF in browser tab
router.get(
  '/:id/view',
  (req, res) => certificateController.viewCertificatePdf(req, res)
);

// 3. GET /api/v1/verify/:id/download - Force PDF file download attachment
router.get(
  '/:id/download',
  (req, res) => certificateController.downloadCertificatePdf(req, res)
);

export default router;
