import User from "../models/User.js";
import UserPreference from "../models/UserPreference.js";
import jwt from "jsonwebtoken";
import crypto from "crypto";
import { pool } from "../config/db.js";
import { isAdminEmail } from "../middleware/admin.js";
import { ensureDefaultRecipesForUser } from "./recipeController.js";
import { OAuth2Client } from "google-auth-library";

const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

const ACCESS_TOKEN_EXPIRY = '15m';
const REFRESH_TOKEN_EXPIRY_MS = 7 * 24 * 60 * 60 * 1000;

const isProd = (req) =>
    process.env.NODE_ENV === 'production' || req.secure || req.headers['x-forwarded-proto'] === 'https';

const generateAccessToken = (user) =>
    jwt.sign({ id: user.id, email: user.email }, process.env.JWT_SECRET, { expiresIn: ACCESS_TOKEN_EXPIRY });

const generateRefreshToken = () => crypto.randomBytes(40).toString('hex');

const hashToken = (token) => crypto.createHash('sha256').update(token).digest('hex');

const storeRefreshToken = async (userId, rawToken) => {
    const hash = hashToken(rawToken);
    const expiresAt = new Date(Date.now() + REFRESH_TOKEN_EXPIRY_MS);
    await pool.query(
        `INSERT INTO refresh_tokens (user_id, token_hash, expires_at) VALUES ($1, $2, $3)`,
        [userId, hash, expiresAt]
    );
};

const revokeUserRefreshTokens = async (userId) => {
    await pool.query(
        `UPDATE refresh_tokens SET revoked_at = NOW() WHERE user_id = $1 AND revoked_at IS NULL`,
        [userId]
    );
};

const setAuthCookies = (res, req, accessToken, refreshToken) => {
    const prod = isProd(req);
    res.cookie('token', accessToken, {
        httpOnly: true,
        secure: prod,
        sameSite: prod ? 'none' : 'lax',
        maxAge: 15 * 60 * 1000
    });
    res.cookie('refreshToken', refreshToken, {
        httpOnly: true,
        secure: prod,
        sameSite: prod ? 'none' : 'lax',
        path: '/api/auth',
        maxAge: REFRESH_TOKEN_EXPIRY_MS
    });
};

const clearAuthCookies = (res, req) => {
    const prod = isProd(req);
    const base = { httpOnly: true, secure: prod, sameSite: prod ? 'none' : 'lax' };
    res.clearCookie('token', base);
    res.clearCookie('refreshToken', { ...base, path: '/api/auth' });
};

const formatUserResponse = (user) => ({
    id: user.id,
    email: user.email,
    name: user.name,
    avatar_url: user.avatar_url,
    isAdmin: isAdminEmail(user.email)
});

const issueTokensAndRespond = async (res, req, user, statusCode, message) => {
    const accessToken = generateAccessToken(user);
    const refreshToken = generateRefreshToken();
    await storeRefreshToken(user.id, refreshToken);
    setAuthCookies(res, req, accessToken, refreshToken);

    res.status(statusCode).json({
        success: true,
        message,
        data: {
            token: accessToken,
            user: formatUserResponse(user)
        }
    });
};

export const register = async (req, res, next) => {
    try {
        const { email, name, password } = req.body;

        if (!email || !name || !password) {
            return res.status(400).json({ success: false, message: "All fields are required" });
        }

        const userExists = await User.findOne({ email });
        if (userExists) {
            return res.status(400).json({ success: false, message: "User already exists" });
        }

        const user = await User.create({ email, name, password });

        await UserPreference.create(user.id, {
            dietary_restrictions: [],
            allergens: [],
            preference_cuisine: [],
            default_servings: 4,
            measurement_system: "metric",
        });

        await ensureDefaultRecipesForUser(user.id);

        await issueTokensAndRespond(res, req, user, 201, "User registered successfully");
    } catch (error) {
        next(error);
    }
};

export const login = async (req, res, next) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({ success: false, message: "All fields are required" });
        }

        const user = await User.findOne({ email });
        if (!user) {
            return res.status(401).json({ success: false, message: "Invalid credentials" });
        }

        const isPasswordValid = await User.verifyPassword(password, user.password);
        if (!isPasswordValid) {
            return res.status(401).json({ success: false, message: "Invalid credentials" });
        }

        await issueTokensAndRespond(res, req, user, 200, "User logged in successfully");
    } catch (error) {
        next(error);
    }
};

export const logout = async (req, res, next) => {
    try {
        await revokeUserRefreshTokens(req.user.id);
        clearAuthCookies(res, req);
        res.status(200).json({ success: true, message: "Logged out successfully" });
    } catch (error) {
        next(error);
    }
};

export const refreshAccessToken = async (req, res, next) => {
    try {
        const rawToken = req.cookies?.refreshToken;
        if (!rawToken) {
            return res.status(401).json({ success: false, message: "No refresh token" });
        }

        const hash = hashToken(rawToken);
        const { rows } = await pool.query(
            `SELECT * FROM refresh_tokens WHERE token_hash = $1 AND revoked_at IS NULL AND expires_at > NOW()`,
            [hash]
        );

        if (rows.length === 0) {
            return res.status(401).json({ success: false, message: "Invalid or expired refresh token" });
        }

        const tokenRow = rows[0];
        const user = await User.findById(tokenRow.user_id);
        if (!user) {
            return res.status(401).json({ success: false, message: "User not found" });
        }

        // Rotate: revoke old, issue new
        await pool.query(`UPDATE refresh_tokens SET revoked_at = NOW() WHERE id = $1`, [tokenRow.id]);

        const newAccessToken = generateAccessToken(user);
        const newRefreshToken = generateRefreshToken();
        await storeRefreshToken(user.id, newRefreshToken);
        setAuthCookies(res, req, newAccessToken, newRefreshToken);

        res.json({
            success: true,
            data: {
                token: newAccessToken,
                user: formatUserResponse(user)
            }
        });
    } catch (error) {
        next(error);
    }
};

export const getCurrentUser = async (req, res, next) => {
    try {
        const user = await User.findById(req.user.id);

        if (!user) {
            return res.status(404).json({ success: false, message: "User not found" });
        }

        const preferences = await UserPreference.findByUserId(req.user.id);

        res.json({
            success: true,
            data: {
                user: { ...user, isAdmin: isAdminEmail(user.email) },
                preferences
            }
        });
    } catch (error) {
        next(error);
    }
};

export const requestPasswordReset = async (req, res, next) => {
    try {
        const { email } = req.body;

        if (!email) {
            return res.status(400).json({ success: false, message: "Email is required" });
        }

        const user = await User.findOne({ email });
        if (!user) {
            return res.status(404).json({ success: false, message: "User not found" });
        }

        return res.status(501).json({ success: false, message: "Password reset is not implemented yet" });
    } catch (error) {
        next(error);
    }
};

export const googleAuth = async (req, res, next) => {
    try {
        const { credential } = req.body;

        if (!credential) {
            return res.status(400).json({ success: false, message: "Google credential is required" });
        }

        let payload;
        try {
            const ticket = await googleClient.verifyIdToken({
                idToken: credential,
                audience: process.env.GOOGLE_CLIENT_ID
            });
            payload = ticket.getPayload();
        } catch (verifyError) {
            console.error('[Google Auth] Token verification failed:', verifyError.message);
            return res.status(401).json({ success: false, message: "Invalid or expired Google token" });
        }

        const { email, name, picture, sub: google_id } = payload;

        if (!email) {
            return res.status(400).json({ success: false, message: "No email associated with this Google account" });
        }

        const { user, isNewUser } = await User.findOrCreateOAuthUser({
            email,
            name: name || email.split('@')[0],
            avatar_url: picture,
            google_id,
            provider: 'google'
        });

        if (isNewUser) {
            try {
                await UserPreference.create(user.id, {
                    dietary_restrictions: [],
                    allergens: [],
                    preference_cuisine: [],
                    default_servings: 4,
                    measurement_system: "metric",
                });
                await ensureDefaultRecipesForUser(user.id);
            } catch (initErr) {
                console.warn('[Google Auth] Notice: preference or recipe init error:', initErr.message);
            }
        }

        const msg = isNewUser ? "Account created with Google successfully" : "Logged in with Google successfully";
        await issueTokensAndRespond(res, req, { ...user, auth_provider: user.auth_provider }, 200, msg);
    } catch (error) {
        next(error);
    }
};
