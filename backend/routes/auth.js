import express from 'express';
const router = express.Router();
import * as authController from '../controllers/authController.js';
import authMiddleware from '../middleware/auth.js';
import { registerValidation, loginValidation } from '../middleware/validation.js';
import { authLimiter } from '../middleware/rateLimiter.js';

// public routes with validation and rate limiting
router.post('/signup', authLimiter, registerValidation, authController.register);
router.post('/login', authLimiter, loginValidation, authController.login);
router.post('/google', authLimiter, authController.googleAuth);
router.post('/reset-password', authLimiter, authController.requestPasswordReset);

// protected routes
router.get('/me', authMiddleware, authController.getCurrentUser);
router.post('/logout', authMiddleware, authController.logout);


export default router;