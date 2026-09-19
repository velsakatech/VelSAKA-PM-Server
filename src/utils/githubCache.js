// server/src/utils/githubCache.js

const cache = new Map();

const DEFAULT_TTL = 5 * 60 * 1000; // 5 minutes

export const getCached = (key) => {
  const entry = cache.get(key);

  if (!entry) return null;

  if (Date.now() > entry.expiresAt) {
    cache.delete(key);
    return null;
  }

  return entry.data;
};

export const setCache = (key, data, ttl = DEFAULT_TTL) => {
  cache.set(key, {
    data,
    expiresAt: Date.now() + ttl,
  });
};

export const clearCache = () => cache.clear();