// backend/sockets/socialSocket.js
import jwt from 'jsonwebtoken';
import { pool } from '../config/db.js';

/**
 * Initialize Socket.io connection
 * Authenticates users via JWT token passed in query params
 * @param {socket.io.Server} io - Socket.io server instance
 */
export function initializeSocialSocket(io) {
  // Middleware to authenticate socket connections (optional for unauthenticated users)
  io.use((socket, next) => {
    try {
      const candidates = [];
      const authToken = socket.handshake.auth?.token || socket.handshake.query?.token;
      if (authToken && authToken !== 'null' && authToken !== 'undefined') {
        candidates.push(authToken);
      }

      if (socket.handshake.headers?.cookie) {
        const cookiePair = socket.handshake.headers.cookie
          .split(';')
          .map((c) => c.trim().split('='))
          .find(([key]) => key === 'token');
        if (cookiePair && cookiePair[1] && cookiePair[1] !== 'null' && cookiePair[1] !== 'undefined' && !candidates.includes(cookiePair[1])) {
          candidates.push(cookiePair[1]);
        }
      }

      socket.isAuthenticated = false;
      for (const candidate of candidates) {
        try {
          const decoded = jwt.verify(candidate, process.env.JWT_SECRET, { ignoreExpiration: true });
          const nowSec = Math.floor(Date.now() / 1000);
          const maxSessionAgeSec = 7 * 24 * 60 * 60;
          if (decoded?.id && (!decoded.exp || nowSec - decoded.exp < maxSessionAgeSec)) {
            socket.userId = decoded.id;
            socket.email = decoded.email;
            socket.isAuthenticated = true;
            break;
          }
        } catch {
          // Try next candidate
        }
      }

      if (!socket.isAuthenticated || !socket.userId) {
        return next(new Error('Unauthorized: Authentication required'));
      }

      next();
    } catch (error) {
      console.error('Socket.io auth middleware error:', error);
      next(new Error('Authentication failed'));
    }
  });

  // Default namespace connection - MUST exist
  io.on('connection', (socket) => {
    if (socket.userId) {
      console.log(`✅ Authenticated user ${socket.userId} connected via Socket.io (${socket.id})`);
      socket.join(`user:${socket.userId}:notifications`);
      socket.join(`user:${socket.userId}:mealplan`);
    } else {
      console.log(`✅ Guest connected via Socket.io (${socket.id})`);
    }

    // Send connection confirmation
    socket.emit('connection:success', { 
      message: 'Connected to Socket.io',
      userId: socket.userId || null,
      isAuthenticated: socket.isAuthenticated
    });

    // Handle disconnect
    socket.on('disconnect', () => {
      console.log(`❌ Socket disconnected (${socket.id})`);
    });

    // Echo/ping test
    socket.on('ping', (data) => {
      socket.emit('pong', { message: 'pong', data });
    });

    // --- Notification Events ---
    // NOTE: notification:send removed - notifications must originate from backend controllers only

    socket.on('notification:read', (notificationId) => {
      if (socket.userId) {
        io.to(`user:${socket.userId}:notifications`).emit('notification:read', {
          notificationId
        });
      }
    });

    // --- Typing Indicators ---
    socket.on('typing:start', (conversationId) => {
      if (!socket.userId) {
        socket.emit('error', { message: 'Authentication required' });
        return;
      }
      socket.to(`conversation:${conversationId}`).emit('typing:start', {
        userId: socket.userId,
        userName: socket.email
      });
    });

    /**
     * Emit when user stops typing
     */
    socket.on('typing:end', (conversationId) => {
      if (!socket.userId) {
        socket.emit('error', { message: 'Authentication required' });
        return;
      }
      socket.to(`conversation:${conversationId}`).emit('typing:end', {
        userId: socket.userId
      });
    });

    // --- Activity Updates ---

    /**
     * Emit like activity to followers
     * Called when post is liked
     * Validates that socket.userId matches the liker
     */
    socket.on('activity:like', (data) => {
      if (!socket.userId) {
        socket.emit('error', { message: 'Authentication required' });
        return;
      }
      // Ensure the liker is the authenticated user
      if (data.likerId && data.likerId !== socket.userId) {
        socket.emit('error', { message: 'Unauthorized: Cannot send likes as another user' });
        return;
      }
      // Broadcast to followers room
      io.to(`activity:${data.postAuthorId}:followers`).emit('activity:like', {
        ...data,
        likerId: socket.userId // Force authentic userId
      });
    });

    /**
     * Emit new post to followers
     */
    socket.on('activity:post', (data) => {
      if (!socket.userId) {
        socket.emit('error', { message: 'Authentication required' });
        return;
      }
      // Broadcast to authenticated user's own followers
      io.to(`activity:${socket.userId}:followers`).emit('activity:post', {
        ...data,
        userId: socket.userId // Force authentic userId
      });
    });

    /**
     * User subscribes to follower activity updates
     * Call when user navigates to feed
     */
    socket.on('activity:subscribe', (targetUserId) => {
      socket.join(`activity:${targetUserId}:followers`);
    });

    /**
     * User unsubscribes from follower activity
     */
    socket.on('activity:unsubscribe', (targetUserId) => {
      socket.leave(`activity:${targetUserId}:followers`);
    });

    // --- Messaging Events (Week 2) ---

    /**
     * User joins a conversation room to receive real-time messages
     * Called when user opens a conversation
     * NOW WITH AUTHORIZATION CHECK
     */
    socket.on('conversation:join', async (conversationId) => {
      if (!socket.userId) {
        socket.emit('error', { message: 'Authentication required' });
        return;
      }

      try {
        // Verify user is participant in this conversation
        const result = await pool.query(
          `SELECT id FROM conversations 
           WHERE id = $1 AND (user_one_id = $2 OR user_two_id = $2 OR participant_1_id = $2 OR participant_2_id = $2)`,
          [conversationId, socket.userId]
        );

        if (result.rows.length === 0) {
          socket.emit('error', { 
            message: 'Unauthorized: You are not a participant in this conversation' 
          });
          return;
        }

        socket.join(`conversation:${conversationId}`);
        console.log(`User ${socket.userId} joined conversation room: ${conversationId}`);
      } catch (error) {
        console.error('Error joining conversation:', error);
        socket.emit('error', { message: 'Failed to join conversation' });
      }
    });

    /**
     * User leaves a conversation room
     * Called when user closes/navigates away from conversation
     */
    socket.on('conversation:leave', (conversationId) => {
      socket.leave(`conversation:${conversationId}`);
      console.log(`User ${socket.userId} left conversation room: ${conversationId}`);
    });

    /**
     * User starts typing indicator in a conversation
     * Already handled in Typing Indicators section above
     */
    // socket.on('typing:start', (conversationId) => {...}); // Already defined

    /**
     * User stops typing indicator in a conversation
     * Already handled in Typing Indicators section above
     */
    // socket.on('typing:end', (conversationId) => {...}); // Already defined

    /**
     * Streak update notification broadcasted to follower activity
     */
    socket.on('activity:streak', (data) => {
      if (!socket.userId) {
        socket.emit('error', { message: 'Authentication required' });
        return;
      }
      // Broadcast authenticated user's streak to their followers
      io.to(`activity:${socket.userId}:followers`).emit('activity:streak', {
        ...data,
        userId: socket.userId // Force authentic userId
      });
    });

    // --- Error handling ---

    socket.on('error', (error) => {
      console.error(`Socket error for user ${socket.userId}:`, error);
    });
  });

  return io;
}

/**
 * Emit notification to a specific user
 * Use this in controllers to emit notifications via Socket.io
 * @param {socket.io.Server} io - Socket.io server instance
 * @param {string} userId - User ID to notify
 * @param {Object} data - Notification data
 */
export function emitNotification(io, userId, data) {
  io.to(`user:${userId}:notifications`).emit('notification:new', data);
}

/**
 * Broadcast activity to user's followers
 * Use this when user creates a post or takes action
 * @param {socket.io.Server} io - Socket.io server instance
 * @param {string} userId - User ID
 * @param {string} eventType - Event type (post, like, etc)
 * @param {Object} data - Event data
 */
export function broadcastActivity(io, userId, eventType, data) {
  io.to(`activity:${userId}:followers`).emit(`activity:${eventType}`, {
    userId,
    ...data
  });
}
