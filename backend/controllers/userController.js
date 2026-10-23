import User from "../models/User.js";
import UserPreference from "../models/UserPreference.js";
import PantryItem from "../models/PantryItem.js";
import MealPlan from "../models/MealPlan.js";
import Recipe from "../models/Recipe.js";
import Post from "../models/social/Post.js";
import cacheService from "../services/cacheService.js";
import ApiError from "../utils/ApiError.js";

const buildDashboardSummaryForUser = async (userId) => {
    const [pantryRes, mealsRes, recentRes, upcomingRes, postsRes] = await Promise.allSettled([
        PantryItem.getStats(userId),
        MealPlan.getStats(userId),
        Recipe.getRecent(userId, 5),
        MealPlan.getUpcomingMeals(userId, 5),
        Post.getFeed(userId, 20, 0)
    ]);

    const pantryStats = pantryRes.status === 'fulfilled' ? pantryRes.value : null;
    const mealStats = mealsRes.status === 'fulfilled' ? mealsRes.value : null;
    const recentRecipes = recentRes.status === 'fulfilled' && Array.isArray(recentRes.value) ? recentRes.value : [];
    const upcomingMeals = upcomingRes.status === 'fulfilled' && Array.isArray(upcomingRes.value) ? upcomingRes.value : [];
    const rawPosts = postsRes.status === 'fulfilled' && Array.isArray(postsRes.value) ? postsRes.value : [];

    const popularPosts = [...rawPosts]
        .sort((a, b) => {
            const scoreA = (Number(a.like_count) || 0) * 3 + (Number(a.comment_count) || 0);
            const scoreB = (Number(b.like_count) || 0) * 3 + (Number(b.comment_count) || 0);
            return scoreB - scoreA;
        })
        .slice(0, 4);

    return {
        stats: {
            totalRecipes: recentRecipes.length,
            pantryItems: Number(pantryStats?.total_items ?? 0),
            mealsThisWeek: Number(mealStats?.this_week_count ?? 0)
        },
        recentRecipes,
        upcomingMeals,
        popularPosts
    };
};

// Proactively warm dashboard summary + pantry + recipes cache in the background
export const warmUserDashboardCache = async (userId) => {
    if (!userId) return;
    try {
        await Promise.allSettled([
            cacheService.getOrSet(
                cacheService.CACHE_KEYS.DASHBOARD_SUMMARY(userId),
                () => buildDashboardSummaryForUser(userId),
                cacheService.TTL_CONFIG.DASHBOARD
            ),
            cacheService.getOrSet(
                cacheService.CACHE_KEYS.API_GET(userId, '/api/pantry'),
                async () => {
                    const items = await PantryItem.findByUserId(userId, {});
                    return { success: true, data: { items } };
                },
                cacheService.TTL_CONFIG.API_GET
            ),
            cacheService.getOrSet(
                cacheService.CACHE_KEYS.API_GET(userId, '/api/recipes'),
                async () => {
                    const recipes = await Recipe.findByUserId(userId, {});
                    return { success: true, data: { recipes } };
                },
                cacheService.TTL_CONFIG.API_GET
            )
        ]);
    } catch {
        // Ignore background warm errors
    }
};

// get unified dashboard summary (collapses 5 client requests into 1 cached payload)
export const getDashboardSummary = async (req, res, next) => {
    try {
        const userId = req.user.id;
        const summary = await cacheService.getOrSet(
            cacheService.CACHE_KEYS.DASHBOARD_SUMMARY(userId),
            () => buildDashboardSummaryForUser(userId),
            cacheService.TTL_CONFIG.DASHBOARD
        );

        res.json({
            success: true,
            data: summary
        });
    } catch (error) {
        next(error instanceof ApiError ? error : ApiError.internal('Failed to fetch dashboard summary'));
    }
};

// get user profile
export const getProfile = async (req, res, next) => {
    try {
        const userId = req.user.id;
        const [user, preferences] = await Promise.all([
            User.findById(userId),
            UserPreference.findByUserId(userId)
        ]);
        if (!user) throw ApiError.notFound("User not found");
        res.json({ success: true, data: { user, preferences } });
    } catch (error) {
        next(error instanceof ApiError ? error : ApiError.internal('Failed to fetch profile'));
    }
};

// update user profile
export const updateProfile = async (req, res, next) => {
    try {
        const userId = req.user.id;
        const { name, email, avatar_url } = req.body;
        const user = await User.update(userId, { name, email, avatar_url });
        await cacheService.invalidateUser(userId);
        res.json({ success: true, message: "Profile updated successfully", data: { user } });
    } catch (error) {
        next(error instanceof ApiError ? error : ApiError.internal('Failed to update profile'));
    }
};

// update user preferences
export const updatePreferences = async (req, res, next) => {
    try {
        const userId = req.user.id;
        const preferences = await UserPreference.create(userId, req.body);
        await cacheService.invalidateUserSession(userId);
        res.json({ success: true, message: "Preferences updated successfully", data: { preferences } });
    } catch (error) {
        next(error instanceof ApiError ? error : ApiError.internal('Failed to update preferences'));
    }
};

// change password
export const changePassword = async (req, res, next) => {
    try {
        const userId = req.user.id;
        const { currentPassword, newPassword } = req.body;

        if (!currentPassword || !newPassword) {
            throw ApiError.badRequest("Current password and new password are required");
        }

        const user = await User.findWithPasswordById(userId);
        const isValid = await User.verifyPassword(currentPassword, user.password);
        if (!isValid) throw ApiError.badRequest("Current password is incorrect");

        await User.updatePassword(userId, newPassword);
        res.json({ success: true, message: "Password changed successfully" });
    } catch (error) {
        next(error instanceof ApiError ? error : ApiError.internal('Failed to change password'));
    }
};

// delete account
export const deleteAccount = async (req, res, next) => {
    try {
        const userId = req.user.id;
        await User.delete(userId);
        await cacheService.invalidateUser(userId);
        res.json({ success: true, message: "Account deleted successfully" });
    } catch (error) {
        next(error);
    }
};
