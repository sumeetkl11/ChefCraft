import jwt from "jsonwebtoken";

const authMiddleware = async (req, res, next) => {
    try {
        const candidates = [];

        // 1. Check Authorization header
        const authHeader = req.header("Authorization");
        if (authHeader?.startsWith("Bearer ")) {
            const bearerToken = authHeader.replace("Bearer ", "").trim();
            if (bearerToken && bearerToken !== 'null' && bearerToken !== 'undefined') {
                candidates.push(bearerToken);
            }
        }

        // 2. Check cookie token
        if (req.cookies?.token) {
            const cookieToken = req.cookies.token;
            if (cookieToken && cookieToken !== 'null' && cookieToken !== 'undefined' && !candidates.includes(cookieToken)) {
                candidates.push(cookieToken);
            }
        }

        if (candidates.length === 0) {
            return res.status(401).json({
                success: false,
                message: "No authentication token, access denied"
            });
        }

        let decoded = null;
        for (const candidate of candidates) {
            try {
                const payload = jwt.verify(candidate, process.env.JWT_SECRET);
                if (payload?.id) {
                    decoded = payload;
                    break;
                }
            } catch {
                // Try next token candidate
            }
        }

        if (!decoded?.id) {
            return res.status(401).json({
                success: false,
                message: "Invalid or expired token"
            });
        }

        req.user = {
            id: decoded.id,
            email: decoded.email
        };

        next();
    } catch {
        return res.status(401).json({
            success: false,
            message: "Invalid or expired token"
        });
    }
};

export const optionalAuthMiddleware = async (req, res, next) => {
    try {
        let token = req.cookies?.token;
        
        if (!token) {
            const authHeader = req.header("Authorization");
            if (authHeader?.startsWith("Bearer ")) {
                token = authHeader.replace("Bearer ", "");
            }
        }

        if (token) {
            const decoded = jwt.verify(token, process.env.JWT_SECRET);
            if (decoded.id) {
                req.user = {
                    id: decoded.id,
                    email: decoded.email
                };
            }
        }
    } catch {
        // Optional auth: ignore invalid tokens cleanly
    }
    next();
};

export default authMiddleware;
