import express from 'express';
const router = express.Router();
import * as userController from '../controllers/userController.js';
import authMiddleware from '../middleware/auth.js';

// all routes are protected
router.use(authMiddleware);

// user routes
router.get('/dashboard-summary', userController.getDashboardSummary);
router.get('/profile', userController.getProfile);
router.put('/profile', userController.updateProfile);
router.put('/preferences', userController.updatePreferences);
router.put('/change-password', userController.changePassword);
router.delete('/account', userController.deleteAccount);

export default router;