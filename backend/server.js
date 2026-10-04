import dotenv from 'dotenv';
dotenv.config();

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


const PORT = process.env.PORT || 8000;
const app = express();

// Trust proxy to get real client IP behind load balancers (Render, Vercel, etc)
app.set('trust proxy', 1);

const configuredOrigins = [
  process.env.CLIENT_URL,
  process.env.FRONTEND_URL,
  process.env.FRONTEND_ORIGIN
]
  .flatMap((value) => (value ? value.split(',') : []))
  .map((value) => value.trim())
  .filter(Boolean);

const allowedOrigins = new Set([
  'http://localhost:5173',
  'http://localhost:5174',
  'http://192.168.x.x:5173',
  'https://tastebuds-main.vercel.app',
  'https://chef-craft.vercel.app',
  ...configuredOrigins
]);

function isAllowedOrigin(origin) {
  // Allow requests with no origin (like mobile apps, curl, or same-origin)
  if (!origin) {
    return true;
  }

  return allowedOrigins.has(origin);
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

// Security middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
    },
  },
  crossOriginEmbedderPolicy: false,
}));

app.use(cors(corsOptions));
app.use(cookieParser());

// Apply general rate limiting to all routes
app.use(generalLimiter);

// Inject socket instance into req (ponytail: inlined middleware)
app.use((req, res, next) => {
  req.io = req.app.get('io');
  next();
});

// Gzip/Brotli response compression for ultra-fast payload delivery
app.use(compression());

// Middleware
app.use(express.json({ limit: '5mb' }));
app.use(express.urlencoded({ extended: true, limit: '5mb' }));

// Test routes & static handlers
app.get('/favicon.ico', (req, res) => res.status(204).end());
app.get('/', (req, res) => {
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

// 404 handler for undefined routes (must be after all routes)
app.use(notFoundHandler);

// Global error handler (must be last)
app.use(errorHandler);

// Start HTTP server (includes Express and Socket.io)
initDB().then(() => {
    const server = httpServer.listen(PORT, '0.0.0.0', () => {
        console.log(`🚀 Server running on port ${PORT}`);
        console.log(`📡 Socket.io enabled`);
        console.log(`🔗 WebSocket URL: ws://localhost:${PORT}`);
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
