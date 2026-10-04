import express from 'express';
const router = express.Router();
import * as pantryController from '../controllers/pantryController.js';
import authMiddleware from '../middleware/auth.js';
import { addPantryItemValidation, updatePantryItemValidation, uuidParamValidation } from '../middleware/validation.js';

router.use(authMiddleware);

router.get('/', pantryController.getPantryItems);
router.get('/stats', pantryController.getPantryStats);
router.get('/expiring-soon', pantryController.getExpiringItems);
router.post('/', addPantryItemValidation, pantryController.addPantryItem);
router.put('/:id', updatePantryItemValidation, pantryController.updatePantryItem);
router.delete('/:id', ...uuidParamValidation(), pantryController.deletePantryItem);

export default router;