import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.resolve(import.meta.dirname, '.env'), override: true });
dotenv.config({ path: path.resolve(import.meta.dirname, '../.env'), override: true });

import express from 'express';
import compression from 'compression';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { generalLimiter } from './middleware/rateLimiter.js';
import { errorHandler, notFoundHandler } from './middleware/errorHandler.js';

// import routes
import authRoutes from './routes/auth.js';
import userRoutes from './routes/user.js';
import adminRoutes from './routes/admin.js';
import pantryRoutes from './routes/pantry.js';
import recipeRoutes from './routes/recipe.js';
import { initDB } from './config/db.js';
import mealPlanRoutes from './routes/mealPlans.js';
import shoppingListRoutes from './routes/shoppingList.js';
import postsRoutes from './routes/social/posts.js';
import followersRoutes from './routes/social/followers.js';
import notificationsRoutes from './routes/social/notifications.js';
import messagesRoutes from './routes/messaging/messages.js';
import streaksRoutes from './routes/social/streaks.js';
import challengesRoutes from './routes/challenges/challenges.js';
import collectionsRoutes from './routes/collections/collections.js';

// Marketplace routes
import listingsRoutes from './routes/marketplace/listings.js';
import purchasesRoutes from './routes/marketplace/purchases.js';
import wishlistsRoutes from './routes/marketplace/wishlists.js';
import reviewsRoutes from './routes/marketplace/reviews.js';
import clientErrorsRoute from './routes/clientErrors.js';
import uploadRoutes from './routes/upload.js';

// import Socket.io setup
import { initializeSocialSocket } from './sockets/socialSocket.js';
import cacheService from './services/cacheService.js';
import { warmUserDashboardCache } from './controllers/userController.js';
import jwt from 'jsonwebtoken';

import fs from 'fs';

if (!process.env.JWT_SECRET) {
  process.env.JWT_SECRET = 'dev-jwt-secret-key-kitchen-canvas';
}

const PORT = process.env.PORT || 3000;
const app = express();

// Trust proxy to get real client IP behind load balancers (Render, Vercel, etc)
app.set('trust proxy', 1);

const configuredOrigins = [
  process.env.CLIENT_URL,
  process.env.FRONTEND_URL,
  process.env.FRONTEND_ORIGIN,
  process.env.APP_URL
]
  .flatMap((value) => (value ? value.split(',') : []))
  .map((value) => value.trim())
  .filter(Boolean);

const allowedOrigins = new Set([
  'http://localhost:3000',
  'http://localhost:5173',
  'http://localhost:5174',
  'http://192.168.x.x:5173',
  'https://tastebuds-main.vercel.app',
  'https://chef-craft.vercel.app',
  ...configuredOrigins
]);

function isAllowedOrigin(origin) {
  if (!origin) {
    return true;
  }

  if (allowedOrigins.has(origin) || origin.endsWith('.run.app') || origin.includes('localhost')) {
    return true;
  }

  return true;
}

const corsOptions = {
  origin(origin, callback) {
    if (isAllowedOrigin(origin)) {
      callback(null, true);
      return;
    }

    callback(null, false);
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
};

// Create HTTP server (required for Socket.io)
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: corsOptions,
  transports: ['websocket', 'polling']
});

// Initialize Socket.io handlers
initializeSocialSocket(io);

// Store io instance on app instead of global
app.set('io', io);

// Gzip/Brotli response compression FIRST so both static assets and API responses are compressed
app.use(compression());

// Security middleware (disabled frameguard/CSP so AI Studio iframe and external fonts/images work)
app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginEmbedderPolicy: false,
  frameguard: false,
}));

// Serve built frontend static files BEFORE rate-limiters, cookie-parser, and JSON body parsers
const frontendDistPath = path.resolve(import.meta.dirname, '../frontend/dist');
if (fs.existsSync(frontendDistPath)) {
  app.use('/assets', express.static(path.join(frontendDistPath, 'assets'), {
    maxAge: '1y',
    immutable: true
  }));
  app.use(express.static(frontendDistPath, {
    maxAge: '1h',
    setHeaders(res, filePath) {
      if (filePath.endsWith('index.html')) {
        res.setHeader('Cache-Control', 'no-cache');
      }
    }
  }));
}

// Health check endpoint for Render/uptime monitors
app.get(['/', '/health'], (req, res) => {
  res.status(200).json({ status: 'ok', service: 'chefcraft-backend', timestamp: new Date().toISOString() });
});

app.get('/favicon.ico', (req, res) => res.status(204).end());

app.use(cors(corsOptions));
app.use(cookieParser());

// Apply general rate limiting to API routes only
app.use('/api', generalLimiter);

// Inject socket instance into req
app.use((req, res, next) => {
  req.io = req.app.get('io');
  next();
});

// Fast JWT extraction helper for API caching & invalidation
function resolveUserIdFromReq(req) {
  if (req.user?.id) return req.user.id;
  try {
    let token = null;
    const authHeader = req.header('Authorization');
    if (authHeader?.startsWith('Bearer ')) {
      const b = authHeader.replace('Bearer ', '').trim();
      if (b && b !== 'null' && b !== 'undefined') token = b;
    }
    if (!token && req.cookies?.token && req.cookies.token !== 'null' && req.cookies.token !== 'undefined') {
      token = req.cookies.token;
    }
    if (!token) return null;
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    return decoded?.id || null;
  } catch {
    return null;
  }
}

// High-speed user-scoped GET response cache & automatic mutation invalidation
app.use('/api', async (req, res, next) => {
  const userId = resolveUserIdFromReq(req);

  if (req.method === 'GET' && userId && !req.path.startsWith('/auth/')) {
    const cacheKey = cacheService.CACHE_KEYS.API_GET(userId, req.originalUrl);
    const cachedBody = await cacheService.get(cacheKey);
    if (cachedBody) {
      return res.json(cachedBody);
    }

    const originalJson = res.json.bind(res);
    res.json = (body) => {
      if (res.statusCode >= 200 && res.statusCode < 300 && body?.success !== false) {
        void cacheService.set(cacheKey, body, cacheService.TTL_CONFIG.API_GET);
      }
      return originalJson(body);
    };
    return next();
  }

  if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) {
    res.on('finish', () => {
      const activeUserId = req.user?.id || userId;
      if (res.statusCode >= 200 && res.statusCode < 300 && activeUserId) {
        void cacheService.invalidateDashboardSummary(activeUserId).then(() => {
          void warmUserDashboardCache(activeUserId);
        });
        if (req.path.startsWith('/user')) {
          void cacheService.invalidateUserSession(activeUserId);
        }
      }
    });
  }

  next();
});

// Middleware
app.use(express.json({ limit: '5mb' }));
app.use(express.urlencoded({ extended: true, limit: '5mb' }));

app.get('/api/health', (req, res) => {
    res.json({ message: 'AI RECIPE GENERATOR API' });
});

// API routes
app.use('/api/auth', authRoutes);
app.use('/api/user', userRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/pantry', pantryRoutes);
app.use('/api/recipes', recipeRoutes);
app.use('/api/meal-plans', mealPlanRoutes);
app.use('/api/shopping-list', shoppingListRoutes);

// Social API routes (Week 1)
app.use('/api/posts', postsRoutes);
app.use('/api/users', followersRoutes);
app.use('/api/notifications', notificationsRoutes);

// Messaging & Activity routes (Week 2)
app.use('/api/conversations', messagesRoutes);
app.use('/api/streaks', streaksRoutes);

// Challenges & Collections routes (Week 3)
app.use('/api/challenges', challengesRoutes);
app.use('/api/collections', collectionsRoutes);

// Marketplace & Shopping Routes
app.use('/api/marketplace/listings', listingsRoutes);
app.use('/api/marketplace/purchases', purchasesRoutes);
app.use('/api/marketplace/wishlists', wishlistsRoutes);
app.use('/api/marketplace/reviews', reviewsRoutes);

// Client-side error reporting (no auth required — unauthenticated errors must reach this)
app.use('/api/client-error', clientErrorsRoute);

// Image Upload route (Cloudinary)
app.use('/api/upload', uploadRoutes);

// SPA fallback for non-API routes
if (fs.existsSync(frontendDistPath)) {
  app.get('/{*splat}', (req, res, next) => {
    if (req.path.startsWith('/api')) {
      return next();
    }
    res.setHeader('Cache-Control', 'no-cache');
    res.sendFile(path.join(frontendDistPath, 'index.html'));
  });
}

// 404 handler for undefined routes (must be after all routes)
app.use(notFoundHandler);

// Global error handler (must be last)
app.use(errorHandler);

import { pool } from './config/db.js';

// Start HTTP server (includes Express and Socket.io)
initDB().then(() => {
    const server = httpServer.listen(PORT, '0.0.0.0', () => {
        console.log(`🚀 Server running on port ${PORT}`);
        console.log(`📡 Socket.io enabled`);
        console.log(`🔗 WebSocket URL: ws://localhost:${PORT}`);

        // Background pre-warm for active users so first page open is instant (<3ms)
        void pool.query('SELECT id FROM users ORDER BY created_at DESC LIMIT 5')
            .then(({ rows }) => Promise.allSettled(rows.map((r) => warmUserDashboardCache(r.id))))
            .catch(() => {});
    });

    server.on('error', (err) => {
        if (err.code === 'EADDRINUSE') {
            console.warn(`[Server] Port ${PORT} in use, retrying in 1.5s...`);
            setTimeout(() => {
                server.close();
                httpServer.listen(PORT, '0.0.0.0');
            }, 1500);
        } else {
            console.error('[Server] Server error:', err);
        }
    });
});
