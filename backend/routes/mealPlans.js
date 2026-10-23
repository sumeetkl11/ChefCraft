import express from 'express';
import * as mealPlanController from '../controllers/mealPlanController.js';
import authMiddleware from '../middleware/auth.js';

const router = express.Router();

router.use(authMiddleware);

router.get('/weekly', mealPlanController.getWeeklyMealPlan);
router.get('/upcoming', mealPlanController.getUpcomingMeals);
router.get('/stats', mealPlanController.getMealPlanStats);
router.post('/cook', mealPlanController.cookMeal);
router.post('/', mealPlanController.addToMealPlan);
router.delete('/:id', mealPlanController.deleteMealPlan);

export default router;