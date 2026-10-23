import User from "../models/User.js";
import UserPreference from "../models/UserPreference.js";
import jwt from "jsonwebtoken";
import crypto from "crypto";
import { pool } from "../config/db.js";
import { isAdminEmail } from "../middleware/admin.js";
import { ensureDefaultRecipesForUser } from "./recipeController.js";
import { OAuth2Client } from "google-auth-library";
import cacheService from "../services/cacheService.js";

const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

const ACCESS_TOKEN_EXPIRY = '7d';
const REFRESH_TOKEN_EXPIRY_MS = 7 * 24 * 60 * 60 * 1000;

const isProd = (req) =>
    process.env.NODE_ENV === 'production' || req.secure || req.headers['x-forwarded-proto'] === 'https';

const generateAccessToken = (user) =>
    jwt.sign({ id: user.id, email: user.email }, process.env.JWT_SECRET, { expiresIn: ACCESS_TOKEN_EXPIRY });

const generateRefreshToken = () => crypto.randomBytes(40).toString('hex');

const hashToken = (token) => crypto.createHash('sha256').update(token).digest('hex');

const storeRefreshToken = async (userId, rawToken) => {
    try {
        const hash = hashToken(rawToken);
        const expiresAt = new Date(Date.now() + REFRESH_TOKEN_EXPIRY_MS);
        await pool.query(
            `INSERT INTO refresh_tokens (user_id, token_hash, expires_at) VALUES ($1, $2, $3)`,
            [userId, hash, expiresAt]
        );
    } catch (err) {
        console.warn('[Auth] storeRefreshToken warning:', err.message);
    }
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
        maxAge: REFRESH_TOKEN_EXPIRY_MS
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

import { warmUserDashboardCache } from "./userController.js";

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
    setAuthCookies(res, req, accessToken, refreshToken);

    const formattedUser = formatUserResponse(user);

    // Non-blocking refresh token persistence & background session/dashboard cache warming
    void storeRefreshToken(user.id, refreshToken);
    void warmUserDashboardCache(user.id);
    void UserPreference.findByUserId(user.id)
        .then((preferences) =>
            cacheService.set(
                cacheService.CACHE_KEYS.USER_SESSION(user.id),
                { user: formattedUser, preferences },
                cacheService.TTL_CONFIG.SESSION
            )
        )
        .catch(() => {});

    res.status(statusCode).json({
        success: true,
        message,
        data: {
            token: accessToken,
            user: formattedUser
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
            return res.status(401).json({ success: false, message: "Invalid email or password" });
        }

        if (!user.password) {
            return res.status(401).json({ success: false, message: "Account registered with Google. Please use Google Sign In." });
        }

        const isPasswordValid = await User.verifyPassword(password, user.password);
        if (!isPasswordValid) {
            return res.status(401).json({ success: false, message: "Invalid email or password" });
        }

        await issueTokensAndRespond(res, req, user, 200, "User logged in successfully");
    } catch (error) {
        console.error('[Login Error]', error);
        next(error);
    }
};

export const logout = async (req, res, next) => {
    try {
        await Promise.all([
            revokeUserRefreshTokens(req.user.id),
            cacheService.invalidateUserSession(req.user.id)
        ]);
        clearAuthCookies(res, req);
        res.status(200).json({ success: true, message: "Logged out successfully" });
    } catch (error) {
        next(error);
    }
};

export const refreshAccessToken = async (req, res, next) => {
    try {
        const rawToken = req.cookies?.refreshToken;
        let userId = null;
        let tokenRowId = null;

        if (rawToken) {
            const hash = hashToken(rawToken);
            const { rows } = await pool.query(
                `SELECT * FROM refresh_tokens WHERE token_hash = $1 AND revoked_at IS NULL AND expires_at > NOW()`,
                [hash]
            );
            if (rows.length > 0) {
                userId = rows[0].user_id;
                tokenRowId = rows[0].id;
            }
        }

        // Fallback for iframe environments where third-party refreshToken cookie is blocked:
        // verify signature of the Bearer token (allowing recent expiration up to 7 days)
        if (!userId) {
            const authHeader = req.header('Authorization');
            const bearerToken = authHeader?.startsWith('Bearer ')
                ? authHeader.replace('Bearer ', '').trim()
                : req.cookies?.token;

            if (bearerToken && bearerToken !== 'null' && bearerToken !== 'undefined') {
                try {
                    const decoded = jwt.verify(bearerToken, process.env.JWT_SECRET, { ignoreExpiration: true });
                    const nowSec = Math.floor(Date.now() / 1000);
                    const maxRefreshAgeSec = 7 * 24 * 60 * 60;
                    if (decoded?.id && (!decoded.exp || nowSec - decoded.exp < maxRefreshAgeSec)) {
                        userId = decoded.id;
                    }
                } catch {
                    // Invalid signature
                }
            }
        }

        if (!userId) {
            return res.status(401).json({ success: false, message: "Invalid or expired refresh token" });
        }

        const user = await User.findById(userId);
        if (!user) {
            return res.status(401).json({ success: false, message: "User not found" });
        }

        if (tokenRowId) {
            void pool.query(`UPDATE refresh_tokens SET revoked_at = NOW() WHERE id = $1`, [tokenRowId]).catch(() => {});
        }

        const newAccessToken = generateAccessToken(user);
        const newRefreshToken = generateRefreshToken();
        void storeRefreshToken(user.id, newRefreshToken);
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
        const userId = req.user.id;
        void warmUserDashboardCache(userId);
        const sessionData = await cacheService.getOrSet(
            cacheService.CACHE_KEYS.USER_SESSION(userId),
            async () => {
                const [user, preferences] = await Promise.all([
                    User.findById(userId),
                    UserPreference.findByUserId(userId)
                ]);
                if (!user) return null;
                return {
                    user: { ...user, isAdmin: isAdminEmail(user.email) },
                    preferences
                };
            },
            cacheService.TTL_CONFIG.SESSION
        );

        if (!sessionData?.user) {
            return res.status(404).json({ success: false, message: "User not found" });
        }

        res.json({
            success: true,
            data: sessionData
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
