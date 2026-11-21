import { Router } from 'express';
import { certificateController } from '../controllers/certificate.controller.js';
import { authenticate } from '../middlewares/auth.middleware.js';
import {
  listCertificatesQueryValidator,
  certificateIdParamValidator
} from '../validators/certificate.validator.js';

const router = Router();

// =========================================================================
// 1. PUBLIC VIEW & DOWNLOAD ENDPOINTS (NO LOGIN REQUIRED)
// Candidates, employers, and verifiers can view and download certificate PDFs
// Accepts Certificate UUID or Verification Code (e.g. PSM-XXXX-XXXX)
// =========================================================================

// GET /api/v1/certificates/:id/view - Stream inline PDF in browser tab
router.get(
  '/:id/view',
  (req, res) => certificateController.viewCertificatePdf(req, res)
);

// GET /api/v1/certificates/:id/download - Force PDF file download attachment
router.get(
  '/:id/download',
  (req, res) => certificateController.downloadCertificatePdf(req, res)
);

// =========================================================================
// 2. AUTHENTICATED MANAGEMENT ENDPOINTS (LOGIN REQUIRED)
// Scoped to Training Centre, District Officer, Quality & State Office
// =========================================================================
router.use(authenticate);

// GET /api/v1/certificates - List certificates with filters & pagination
router.get(
  '/',
  listCertificatesQueryValidator,
  (req, res) => certificateController.listCertificates(req, res)
);

// GET /api/v1/certificates/:id - Retrieve full certificate details & history
router.get(
  '/:id',
  certificateIdParamValidator,
  (req, res) => certificateController.getCertificateById(req, res)
);

export default router;
