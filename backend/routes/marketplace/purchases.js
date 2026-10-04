import express from 'express';
import { createPurchase, getPurchaseHistory, getSalesHistory } from '../../controllers/marketplace/purchaseController.js';
import authMiddleware from '../../middleware/auth.js';
import { createPurchaseValidation } from '../../middleware/validation.js';

const router = express.Router();

router.post('/', authMiddleware, createPurchaseValidation, createPurchase);
router.get('/history', authMiddleware, getPurchaseHistory);
router.get('/sales', authMiddleware, getSalesHistory);

export default router;
