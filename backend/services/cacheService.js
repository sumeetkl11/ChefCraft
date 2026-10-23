// backend/services/cacheService.js
import { redisClient } from '../cache/redis.js';

export const TTL_CONFIG = {
  SESSION: 300,   // 5 minutes for /api/auth/me session lookup (invalidated on profile/pref change)
  DASHBOARD: 300, // 5 minutes for unified dashboard summary (invalidated + re-warmed on mutations)
  API_GET: 120,   // 2 minutes for user-scoped GET endpoints (invalidated on mutations)
  PROFILE: 300,   // 5 minutes
  FEED: 120,      // 2 minutes
  POST: 300,      // 5 minutes
  COMMENTS: 300,  // 5 minutes
  LIKES: 60,      // 1 minute
  RECIPE: 600     // 10 minutes
};

export const CACHE_KEYS = {
  USER_SESSION: (userId) => `session:${userId}`,
  DASHBOARD_SUMMARY: (userId) => `dashboard:summary:${userId}`,
  API_GET: (userId, url) => `api_get:${userId}:${url}`,
  USER_PROFILE: (userId) => `profile:${userId}`,
  FEED: (userId = 'public', page = 1, limit = 10) => `feed:${userId}:${page}:${limit}`,
  POST: (postId) => `post:${postId}`,
  COMMENTS: (postId) => `comments:${postId}`,
  LIKES: (postId) => `likes:${postId}`,
  RECIPE: (recipeId) => `recipe:${recipeId}`
};

/**
 * Safely get cached value or fetch fresh data and set cache
 * Uses external Redis when available, or bounded in-memory TTL store fallback
 */
export const getOrSet = async (key, fetchFn, ttl = 300) => {
  try {
    const cachedData = await redisClient.get(key);
    if (cachedData) {
      return JSON.parse(cachedData);
    }
  } catch (err) {
    console.warn(`[Cache Warning] Failed to GET key "${key}":`, err.message);
  }

  const freshData = await fetchFn();

  if (freshData !== undefined) {
    try {
      await redisClient.setEx(key, ttl, JSON.stringify(freshData));
    } catch (err) {
      console.warn(`[Cache Warning] Failed to SET key "${key}":`, err.message);
    }
  }

  return freshData;
};

/**
 * Directly set a key in cache
 */
export const set = async (key, value, ttl = 300) => {
  try {
    if (value !== undefined) {
      await redisClient.setEx(key, ttl, JSON.stringify(value));
    }
  } catch (err) {
    console.warn(`[Cache Warning] Failed to SET key "${key}":`, err.message);
  }
};

/**
 * Directly get a parsed value from cache
 */
export const get = async (key) => {
  try {
    const cachedData = await redisClient.get(key);
    return cachedData ? JSON.parse(cachedData) : null;
  } catch {
    return null;
  }
};

/**
 * Delete key or keys matching pattern safely
 */
export const del = async (keyOrKeys) => {
  try {
    const keys = Array.isArray(keyOrKeys) ? keyOrKeys : [keyOrKeys];
    if (keys.length > 0) {
      await redisClient.del(keys);
    }
  } catch (err) {
    console.warn(`[Cache Warning] Failed to DEL keys:`, err.message);
  }
};

/**
 * Invalidate cached user-scoped GET responses
 */
export const invalidateUserApiCache = async (userId) => {
  if (!userId) return;
  try {
    const matchedKeys = [];
    let cursor = 0;
    do {
      const result = await redisClient.scan(cursor, {
        MATCH: `api_get:${userId}:*`,
        COUNT: 100
      });
      cursor = typeof result.cursor === 'string' ? parseInt(result.cursor, 10) : result.cursor;
      matchedKeys.push(...result.keys);
    } while (cursor !== 0);

    if (matchedKeys.length > 0) {
      await redisClient.del(matchedKeys);
    }
  } catch (err) {
    console.warn(`[Cache Warning] Failed to invalidate API cache for "${userId}":`, err.message);
  }
};

/**
 * Invalidate cached user session (/api/auth/me)
 */
export const invalidateUserSession = async (userId) => {
  if (!userId) return;
  try {
    await redisClient.del(CACHE_KEYS.USER_SESSION(userId));
    await invalidateUserApiCache(userId);
  } catch (err) {
    console.warn(`[Cache Warning] Failed to invalidate session for "${userId}":`, err.message);
  }
};

/**
 * Invalidate cached unified dashboard summary for a user
 */
export const invalidateDashboardSummary = async (userId) => {
  if (!userId) return;
  try {
    await redisClient.del(CACHE_KEYS.DASHBOARD_SUMMARY(userId));
    await invalidateUserApiCache(userId);
  } catch (err) {
    console.warn(`[Cache Warning] Failed to invalidate dashboard summary for "${userId}":`, err.message);
  }
};

/**
 * Invalidate user profile, session, dashboard summary, and user-specific feed cache
 */
export const invalidateUser = async (userId) => {
  if (!userId) return;
  try {
    await redisClient.del([
      CACHE_KEYS.USER_PROFILE(userId),
      CACHE_KEYS.USER_SESSION(userId),
      CACHE_KEYS.DASHBOARD_SUMMARY(userId)
    ]);
    await invalidateUserApiCache(userId);
    const feedKeys = [];
    let cursor = 0;
    do {
      const result = await redisClient.scan(cursor, {
        MATCH: `feed:${userId}:*`,
        COUNT: 100
      });
      cursor = typeof result.cursor === 'string' ? parseInt(result.cursor, 10) : result.cursor;
      feedKeys.push(...result.keys);
    } while (cursor !== 0);

    if (feedKeys.length > 0) {
      await redisClient.del(feedKeys);
    }
  } catch (err) {
    console.warn(`[Cache Warning] Failed to invalidate user cache for "${userId}":`, err.message);
  }
};

/**
 * Invalidate post cache, including comments and likes
 */
export const invalidatePost = async (postId) => {
  try {
    await redisClient.del([
      CACHE_KEYS.POST(postId),
      CACHE_KEYS.COMMENTS(postId),
      CACHE_KEYS.LIKES(postId)
    ]);
  } catch (err) {
    console.warn(`[Cache Warning] Failed to invalidate post cache for "${postId}":`, err.message);
  }
};

/**
 * Invalidate all feed cache keys
 */
export const invalidateFeeds = async () => {
  try {
    const feedKeys = [];
    let cursor = 0;
    do {
      const result = await redisClient.scan(cursor, {
        MATCH: 'feed:*',
        COUNT: 100
      });
      cursor = typeof result.cursor === 'string' ? parseInt(result.cursor, 10) : result.cursor;
      feedKeys.push(...result.keys);
    } while (cursor !== 0);

    if (feedKeys.length > 0) {
      await redisClient.del(feedKeys);
    }
  } catch (err) {
    console.warn('[Cache Warning] Failed to invalidate feeds cache:', err.message);
  }
};

const cacheService = {
  TTL_CONFIG,
  CACHE_KEYS,
  getOrSet,
  get,
  set,
  del,
  invalidateUserApiCache,
  invalidateUserSession,
  invalidateDashboardSummary,
  invalidateUser,
  invalidatePost,
  invalidateFeeds
};

export default cacheService;
