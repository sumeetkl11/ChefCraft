import express from 'express';
import { createListing, getListings, getListing } from '../../controllers/marketplace/listingController.js';
import authMiddleware from '../../middleware/auth.js';
import { createListingValidation, uuidParamValidation } from '../../middleware/validation.js';

const router = express.Router();

router.get('/', getListings);
router.get('/:id', ...uuidParamValidation(), getListing);
router.post('/', authMiddleware, createListingValidation, createListing);

export default router;
