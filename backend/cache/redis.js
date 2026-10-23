// backend/cache/redis.js
import redis from 'redis';
import dotenv from 'dotenv';

dotenv.config();

const redisUrl = process.env.REDIS_URL;
let redisClient = null;
let isRedisAvailable = false;

if (redisUrl) {
  redisClient = redis.createClient({
    url: redisUrl,
    socket: {
      reconnectStrategy: (retries) => {
        if (retries > 3) {
          console.warn('⚠️  Redis max connection retries reached. Disabling Redis caching.');
          return false; // Stop reconnecting
        }
        return Math.min(retries * 100, 1000);
      }
    }
  });

  redisClient.on('connect', () => {
    isRedisAvailable = true;
    console.log('✅ Connected to Redis');
  });

  redisClient.on('error', (err) => {
    if (isRedisAvailable) {
      console.warn('⚠️  Redis Client Warning:', err.message);
    }
    isRedisAvailable = false;
  });

  redisClient.on('ready', () => {
    isRedisAvailable = true;
    console.log('✅ Redis Client Ready');
  });

  redisClient.connect().catch(() => {
    isRedisAvailable = false;
    console.warn('⚠️  Running without external Redis (in-memory TTL cache active).');
  });
} else {
  console.log('ℹ️  REDIS_URL not configured. Running with bounded in-memory TTL cache fallback.');
}

// Bounded in-memory TTL cache fallback (max 1,000 entries) when external Redis is unavailable
const MAX_MEMORY_ENTRIES = 1000;
const memoryCache = new Map();

function globToRegExp(pattern = '*') {
  const escaped = String(pattern).replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*').replace(/\?/g, '.');
  return new RegExp(`^${escaped}$`);
}

function getMemoryEntry(key) {
  const entry = memoryCache.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    memoryCache.delete(key);
    return null;
  }
  return entry.value;
}

function setMemoryEntry(key, ttlSeconds, value) {
  if (memoryCache.size >= MAX_MEMORY_ENTRIES && !memoryCache.has(key)) {
    const now = Date.now();
    for (const [k, v] of memoryCache.entries()) {
      if (now > v.expiresAt) {
        memoryCache.delete(k);
      }
    }
    if (memoryCache.size >= MAX_MEMORY_ENTRIES) {
      const oldestKey = memoryCache.keys().next().value;
      if (oldestKey !== undefined) {
        memoryCache.delete(oldestKey);
      }
    }
  }
  const ttlMs = Math.max(1, Number(ttlSeconds) || 60) * 1000;
  memoryCache.set(key, {
    value: String(value),
    expiresAt: Date.now() + ttlMs
  });
  return 'OK';
}

function matchMemoryKeys(pattern = '*') {
  const regex = globToRegExp(pattern);
  const now = Date.now();
  const matched = [];
  for (const [k, v] of memoryCache.entries()) {
    if (now > v.expiresAt) {
      memoryCache.delete(k);
    } else if (regex.test(k)) {
      matched.push(k);
    }
  }
  return matched;
}

const safeRedisClient = {
  get isReady() {
    return isRedisAvailable && Boolean(redisClient?.isReady);
  },
  async get(key) {
    if (this.isReady) {
      try {
        return await redisClient.get(key);
      } catch {
        // Fall through to in-memory cache
      }
    }
    return getMemoryEntry(key);
  },
  async setEx(key, ttl, value) {
    if (this.isReady) {
      try {
        return await redisClient.setEx(key, ttl, value);
      } catch {
        // Fall through to in-memory cache
      }
    }
    return setMemoryEntry(key, ttl, value);
  },
  async del(keys) {
    const keyList = Array.isArray(keys) ? keys : [keys];
    for (const k of keyList) {
      memoryCache.delete(k);
    }
    if (this.isReady && keyList.length > 0) {
      try {
        return await redisClient.del(keyList);
      } catch {
        return 0;
      }
    }
    return keyList.length;
  },
  async keys(pattern = '*') {
    if (this.isReady) {
      try {
        return await redisClient.keys(pattern);
      } catch {
        // Fall through to in-memory keys
      }
    }
    return matchMemoryKeys(pattern);
  },
  async scan(cursor = 0, options = {}) {
    if (this.isReady) {
      try {
        return await redisClient.scan(cursor, options);
      } catch {
        // Fall through to in-memory scan
      }
    }
    const pattern = options?.MATCH || '*';
    return {
      cursor: 0,
      keys: matchMemoryKeys(pattern)
    };
  },
  async sendCommand(args) {
    if (!this.isReady) return null;
    try {
      return await redisClient.sendCommand(args);
    } catch {
      return null;
    }
  }
};

export { safeRedisClient as redisClient };
