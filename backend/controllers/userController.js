import User from "../models/User.js";
import UserPreference from "../models/UserPreference.js";
import ApiError from "../utils/ApiError.js";

// get user profile
export const getProfile = async (req, res, next) => {
    try {
        const userId = req.user.id;
        const user = await User.findById(userId);
        if (!user) throw ApiError.notFound("User not found");
        const preferences = await UserPreference.findByUserId(userId);
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
        res.json({ success: true, message: "Account deleted successfully" });
    } catch (error) {
        next(error);
    }
};
