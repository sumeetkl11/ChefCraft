import User from "../models/User.js";
import UserPreference from "../models/UserPreference.js";
import jwt from "jsonwebtoken";
import { isAdminEmail } from "../middleware/admin.js";
import { ensureDefaultRecipesForUser } from "./recipeController.js";
import { OAuth2Client } from "google-auth-library";

const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

// Helper to set cookie consistently
const setAuthCookie = (res, req, token) => {
    const isProduction = process.env.NODE_ENV === 'production' || req.secure || req.headers['x-forwarded-proto'] === 'https';
    res.cookie('token', token, {
        httpOnly: true,
        secure: isProduction,
        sameSite: isProduction ? 'none' : 'lax',
        maxAge: 30 * 24 * 60 * 60 * 1000 // 30 days
    });
};

// Generate JWT token (expects a user object)
const generateToken = (user) => {
    return jwt.sign(
        { id: user.id, email: user.email },
        process.env.JWT_SECRET,
        { expiresIn: "30d" }
    );
};

// Register user
export const register = async (req, res, next) => {
    try {
        const {email, name, password} = req.body;

        // validation
        if (!email || !name || !password) {
            return res.status(400).json({
                success: false,
                message: "All fields are required"
            });
        }

        // check if user already exists
        const userExists = await User.findOne({ email });
        if (userExists) {
            return res.status(400).json({
                success: false,
                message: "User already exists"
            });
        }

        // create user
        const user = await User.create({ email, name, password });

        await UserPreference.create(user.id, {
            dietary_restrictions: [],
            allergens: [],
            preference_cuisine: [],
            default_servings: 4,
            measurement_system: "metric",
        });

        await ensureDefaultRecipesForUser(user.id);

        // generate token and set httpOnly cookie
        const token = generateToken(user);
        
        // Set httpOnly cookie (resilient for cross-origin Vercel<->Render deployment)
        const isProduction = process.env.NODE_ENV === 'production' || req.secure || req.headers['x-forwarded-proto'] === 'https';
        res.cookie('token', token, {
            httpOnly: true,
            secure: isProduction,
            sameSite: isProduction ? 'none' : 'lax',
            maxAge: 30 * 24 * 60 * 60 * 1000 // 30 days
        });
        
        res.status(201).json({
            success: true,
            message: "User registered successfully",
            data: {
                token,
                user: {
                    id: user.id,
                    email: user.email,
                    name: user.name,
                    avatar_url: user.avatar_url,
                    isAdmin: isAdminEmail(user.email)
                }
            }
        });
        
    } catch (error) {
        next(error);
    }
}


// login user
export const login = async (req, res, next) => {
    try {
        const {email, password} = req.body;

        // validation
        if (!email || !password) {
            return res.status(400).json({
                success: false,
                message: "All fields are required"
            });
        }

        // find user
        const user = await User.findOne({email});
        if (!user) {
            return res.status(401).json({
                success: false,
                message: "Invalid credentials"
            });
        }

        // verify password using the static helper
        const isPasswordValid = await User.verifyPassword(password, user.password);
        if (!isPasswordValid) {
            return res.status(401).json({
                success: false,
                message: "Invalid credentials"
            });
        }

        // generate token and set httpOnly cookie
        const token = generateToken(user);
        
        // Set httpOnly cookie (resilient for cross-origin Vercel<->Render deployment)
        const isProduction = process.env.NODE_ENV === 'production' || req.secure || req.headers['x-forwarded-proto'] === 'https';
        res.cookie('token', token, {
            httpOnly: true,
            secure: isProduction,
            sameSite: isProduction ? 'none' : 'lax',
            maxAge: 30 * 24 * 60 * 60 * 1000 // 30 days
        });
        
        res.status(200).json({
            success: true,
            message: "User logged in successfully",
            data: {
                token,
                user: {
                    id: user.id,
                    email: user.email,
                    name: user.name,
                    avatar_url: user.avatar_url,
                    isAdmin: isAdminEmail(user.email)
                }
            }
        });
        
    } catch (error) {
        next(error);
    }
}

// logout user
export const logout = async (req, res, next) => {
    try {
        // Clear the httpOnly cookie
        res.clearCookie('token', {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax'
        });
        
        res.status(200).json({
            success: true,
            message: "Logged out successfully"
        });
    } catch (error) {
        next(error);
    }
};

// get current user
export const getCurrentUser = async (req, res, next) => {
    try {
        const user = await User.findById(req.user.id);
        
        if(!user) {
            return res.status(404).json({
                success: false,
                message: "User not found"
            });
        }
        
        const preferences = await UserPreference.findByUserId(req.user.id);
        
        const authHeader = req.header("Authorization");
        const activeToken = (authHeader?.startsWith("Bearer ") ? authHeader.replace("Bearer ", "").trim() : null) || req.cookies?.token || null;

        res.json({
                success: true,
                data: {
                    user: {
                        ...user,
                        isAdmin: isAdminEmail(user.email)
                    },
                    preferences,
                    token: activeToken
                }
            });
        
    } catch (error) {
        next(error);
    }
}

// request password reset
export const requestPasswordReset = async (req, res, next) => {
    try {
        const {email} = req.body;

        // validation
        if (!email) {
            return res.status(400).json({
                success: false,
                message: "Email is required"
            });
        }

        // find user
        const user = await User.findOne({email});
        if (!user) {
            return res.status(404).json({
                success: false,
                message: "User not found"
            });
        }

        // this feature uses methods that aren't implemented in the simple SQL model
        // just return a not‑implemented response for now
        return res.status(501).json({
            success: false,
            message: "Password reset is not implemented yet"
        });
        
    } catch (error) {
        next(error);
    }
};

// Google OAuth Login / Registration
export const googleAuth = async (req, res, next) => {
    try {
        const { credential } = req.body;

        if (!credential) {
            return res.status(400).json({
                success: false,
                message: "Google credential is required"
            });
        }

        // Verify the ID token with Google
        let payload;
        try {
            const ticket = await googleClient.verifyIdToken({
                idToken: credential,
                audience: process.env.GOOGLE_CLIENT_ID
            });
            payload = ticket.getPayload();
        } catch (verifyError) {
            console.error('[Google Auth] Token verification failed:', verifyError.message);
            return res.status(401).json({
                success: false,
                message: "Invalid or expired Google token"
            });
        }

        const { email, name, picture, sub: google_id } = payload;

        if (!email) {
            return res.status(400).json({
                success: false,
                message: "No email associated with this Google account"
            });
        }

        // Find or create user with smart account linking
        const { user, isNewUser } = await User.findOrCreateOAuthUser({
            email,
            name: name || email.split('@')[0],
            avatar_url: picture,
            google_id,
            provider: 'google'
        });

        // Initialize user preferences & default recipes for first-time signups
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

        const token = generateToken(user);
        setAuthCookie(res, req, token);

        res.status(200).json({
            success: true,
            message: isNewUser ? "Account created with Google successfully" : "Logged in with Google successfully",
            data: {
                token,
                user: {
                    id: user.id,
                    email: user.email,
                    name: user.name,
                    avatar_url: user.avatar_url,
                    auth_provider: user.auth_provider,
                    isAdmin: isAdminEmail(user.email)
                }
            }
        });
    } catch (error) {
        next(error);
    }
};



