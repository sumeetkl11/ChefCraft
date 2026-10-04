// backend/services/cacheService.js
import { redisClient } from '../cache/redis.js';

export const TTL_CONFIG = {
  PROFILE: 300,   // 5 minutes
  FEED: 60,       // 1 minute
  POST: 300,      // 5 minutes
  COMMENTS: 300,  // 5 minutes
  LIKES: 30,      // 30 seconds
  RECIPE: 600     // 10 minutes
};

export const CACHE_KEYS = {
  USER_PROFILE: (userId) => `profile:${userId}`,
  FEED: (userId = 'public', page = 1, limit = 10) => `feed:${userId}:${page}:${limit}`,
  POST: (postId) => `post:${postId}`,
  COMMENTS: (postId) => `comments:${postId}`,
  LIKES: (postId) => `likes:${postId}`,
  RECIPE: (recipeId) => `recipe:${recipeId}`
};

/**
 * Safely get cached value or fetch fresh data and set cache
 */
export const getOrSet = async (key, fetchFn, ttl = 300) => {
  if (redisClient?.isReady) {
    try {
      const cachedData = await redisClient.get(key);
      if (cachedData) {
        return JSON.parse(cachedData);
      }
    } catch (err) {
      console.warn(`[Cache Warning] Failed to GET key "${key}":`, err.message);
    }
  }

  const freshData = await fetchFn();

  if (freshData !== undefined && redisClient?.isReady) {
    try {
      await redisClient.setEx(key, ttl, JSON.stringify(freshData));
    } catch (err) {
      console.warn(`[Cache Warning] Failed to SET key "${key}":`, err.message);
    }
  }

  return freshData;
};

/**
 * Delete key or keys matching pattern safely
 */
export const del = async (keyOrKeys) => {
  if (!redisClient?.isReady) return;
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
 * Invalidate user profile and user specific feed cache
 */
export const invalidateUser = async (userId) => {
  if (!redisClient?.isReady) return;
  try {
    await redisClient.del(CACHE_KEYS.USER_PROFILE(userId));
    // Invalidate user feed keys if any exist using SCAN instead of KEYS
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
  if (!redisClient?.isReady) return;
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
  if (!redisClient?.isReady) return;
  try {
    // Use SCAN instead of KEYS to avoid blocking Redis
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
  del,
  invalidateUser,
  invalidatePost,
  invalidateFeeds
};

export default cacheService;
