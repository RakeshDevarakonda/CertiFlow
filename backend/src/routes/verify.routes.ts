import { Router } from 'express';
import { verifyController } from '../controllers/verify.controller.js';
import { verifyCodeParamValidator } from '../validators/verify.validator.js';

const router = Router();

// Public unauthenticated route - NO AUTH MIDDLEWARE
// GET /api/v1/verify/:code
router.get(
  '/:code',
  verifyCodeParamValidator,
  (req, res) => verifyController.verifyCertificate(req, res)
);

export default router;
