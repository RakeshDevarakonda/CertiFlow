import { Router } from 'express';
import { authController } from '../controllers/auth.controller.js';
import { authenticate } from '../middlewares/auth.middleware.js';
import { signupValidator, loginValidator } from '../validators/auth.validator.js';

const router = Router();

// Public routes with Joi / Celebrate validation
router.post('/signup', signupValidator, (req, res) => authController.signup(req, res));
router.post('/login', loginValidator, (req, res) => authController.login(req, res));

// Authenticated route
router.get('/me', authenticate, (req, res) => authController.getMe(req, res));

export default router;
