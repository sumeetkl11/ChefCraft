import MealPlan from '../models/MealPlan.js';
import Recipe from '../models/Recipe.js';
import PantryItem from '../models/PantryItem.js';
import Streak from '../models/social/Streak.js';
import cacheService from '../services/cacheService.js';

// add recipe to meal plan 
export const addToMealPlan = async (req, res, next) => {
    try {
        const mealPlan = await MealPlan.create(req.user.id, req.body);
        await cacheService.invalidateDashboardSummary(req.user.id);

        if (req.io && req.user?.id) {
            req.io.to(`user:${req.user.id}:mealplan`).emit('mealplan:update', { action: 'add', mealPlan });
        }

        res
        .status(201)
        .json({
            success: true,
            message: 'Recipe added to meal plan',
            data: {mealPlan}
        });
    } catch (error) {
        next(error);
    }
};

// get weekly meal plan 
export const getWeeklyMealPlan = async (req, res, next) => {
    try {
        const { start_date, weekStartDate } = req.query;
        const startDate = start_date || weekStartDate;

        if (!startDate) {
            return res.status(400).json({
                success: false,
                message: 'Start date is required'
            });
        }
        const mealPlans = await MealPlan.getWeeklyMealPlan(req.user.id, startDate);

        res.json({
            success: true,
            data: {mealPlans}
        });
    } catch (error) {
        next(error);
    }
};

// get upcoming meals 
export const getUpcomingMeals = async (req, res, next) => {
    try {
        const limit = parseInt(req.query.limit) || 5;
        const meals = await MealPlan.getUpcomingMeals(req.user.id, limit);
        res.json({
            success: true,
            data: {meals}
        });
    } catch (error) {
        next(error);
    }
};

// dlt meal plan entry 
export const deleteMealPlan = async (req, res, next) => {
    try {
        const { id } = req.params;
        const mealPlan = await MealPlan.delete(id, req.user.id);

        if (!mealPlan) {
            return res.status(404).json({
                success: false,
                message: 'Meal plan entry not found'
            });
        }

        await cacheService.invalidateDashboardSummary(req.user.id);

        if (req.io && req.user?.id) {
            req.io.to(`user:${req.user.id}:mealplan`).emit('mealplan:update', { action: 'delete', id });
        }

        res.json({
            success: true,
            message: 'Meal plan entry deleted',
            data: {mealPlan}
        });
    } catch (error) {
        next(error);
    }
};

// get meal plan stats 
export const getMealPlanStats = async (req, res, next) => {
    try {
        const stats = await MealPlan.getStats(req.user.id);
        res.json({
            success: true,
            data: {stats}
        });
    } catch (error) {
        next(error);
    }
};

// Mark a meal or recipe as cooked: auto-deduct matching ingredients from Pantry & update cooking streak
export const cookMeal = async (req, res, next) => {
    try {
        const userId = req.user.id;
        const { recipeId, servingsMultiplier = 1 } = req.body;

        if (!recipeId) {
            return res.status(400).json({
                success: false,
                message: 'recipeId is required to deduct pantry ingredients'
            });
        }

        const [recipe, pantryItems] = await Promise.all([
            Recipe.findById(recipeId, userId),
            PantryItem.findByUserId(userId, {})
        ]);

        if (!recipe) {
            return res.status(404).json({
                success: false,
                message: 'Recipe not found'
            });
        }

        const ingredients = Array.isArray(recipe.ingredients) ? recipe.ingredients : [];
        const multiplier = Math.max(Number(servingsMultiplier) || 1, 0.25);

        const normalizeName = (str = '') =>
            String(str)
                .toLowerCase()
                .trim()
                .replace(/es$/, '')
                .replace(/s$/, '');

        const deductedItems = [];
        const depletedItems = [];
        const consumedPantryIds = new Set();

        for (const ing of ingredients) {
            const ingNameNorm = normalizeName(ing.name || ing.ingredient_name);
            if (!ingNameNorm) continue;

            const matchedPantry = pantryItems.find((p) => {
                if (consumedPantryIds.has(p.id)) return false;
                const pNorm = normalizeName(p.name);
                return pNorm === ingNameNorm || pNorm.includes(ingNameNorm) || ingNameNorm.includes(pNorm);
            });

            if (!matchedPantry) continue;
            consumedPantryIds.add(matchedPantry.id);

            const currentQty = Number(matchedPantry.quantity) || 0;
            const deductQty = Math.max((Number(ing.quantity) || 1) * multiplier, 0.25);
            const remainingQty = Number((currentQty - deductQty).toFixed(2));

            if (remainingQty <= 0) {
                await PantryItem.delete(matchedPantry.id, userId);
                depletedItems.push({
                    id: matchedPantry.id,
                    name: matchedPantry.name,
                    deducted: currentQty,
                    unit: matchedPantry.unit
                });
            } else {
                const isRunningLow = remainingQty <= 2;
                await PantryItem.update(matchedPantry.id, userId, {
                    name: matchedPantry.name,
                    quantity: remainingQty,
                    unit: matchedPantry.unit,
                    category: matchedPantry.category,
                    expiry_date: matchedPantry.expiry_date,
                    is_running_low: isRunningLow
                });
                deductedItems.push({
                    id: matchedPantry.id,
                    name: matchedPantry.name,
                    deducted: deductQty,
                    remaining: remainingQty,
                    unit: matchedPantry.unit,
                    is_running_low: isRunningLow
                });
            }
        }

        let streak = null;
        try {
            const streakResult = await Streak.updateOnCook(userId);
            streak = streakResult?.rows ? streakResult.rows[0] : streakResult;
        } catch (streakErr) {
            console.warn('[cookMeal] Streak update warning:', streakErr.message);
        }

        await cacheService.invalidateDashboardSummary(userId);

        res.json({
            success: true,
            message: `Cooked "${recipe.name}"! Updated ${deductedItems.length + depletedItems.length} pantry item(s).`,
            data: {
                recipeName: recipe.name,
                deductedItems,
                depletedItems,
                totalMatched: deductedItems.length + depletedItems.length,
                streak
            }
        });
    } catch (error) {
        next(error);
    }
};
