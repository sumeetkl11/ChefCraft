import express from 'express';
import * as recipeController from '../controllers/recipeController.js';
import authMiddleware from '../middleware/auth.js';
import { aiLimiter } from '../middleware/rateLimiter.js';
import { generateRecipeValidation, regenerateRecipeValidation, saveRecipeValidation, updateRecipeValidation, uuidParamValidation } from '../middleware/validation.js';

const router = express.Router();

router.use(authMiddleware);

// Ai generated recipes
router.post('/generate', aiLimiter, generateRecipeValidation, recipeController.generatePantrySuggestions);
router.post('/regenerate', aiLimiter, regenerateRecipeValidation, recipeController.regenerateRecipe);
router.post('/suggestion', aiLimiter, recipeController.getSmartPantrySuggestions);

router.get('/', recipeController.getAllRecipes);
router.get('/recent', recipeController.getRecentRecipes);
router.get('/stats', recipeController.getRecipeStats);
router.get('/:id', ...uuidParamValidation(), recipeController.getRecipeById);
router.post('/', saveRecipeValidation, recipeController.saveRecipe);
router.put('/:id', updateRecipeValidation, recipeController.updateRecipe);
router.delete('/:id', ...uuidParamValidation(), recipeController.deleteRecipe);

export default router;