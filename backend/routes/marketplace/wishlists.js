import express from 'express';
import { getWishlists, createWishlist, getWishlistItems, addWishlistItem } from '../../controllers/marketplace/wishlistController.js';
import authMiddleware from '../../middleware/auth.js';
import { createWishlistValidation, addWishlistItemValidation, uuidParamValidation } from '../../middleware/validation.js';

const router = express.Router();

router.get('/', authMiddleware, getWishlists);
router.post('/', authMiddleware, createWishlistValidation, createWishlist);
router.get('/:id/items', authMiddleware, ...uuidParamValidation(), getWishlistItems);
router.post('/:id/items', authMiddleware, addWishlistItemValidation, addWishlistItem);

export default router;
