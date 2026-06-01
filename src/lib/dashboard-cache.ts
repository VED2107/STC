type CacheEntry<T> = {
  value: T;
  savedAt: number;
};

const cacheMemory = new Map<string, CacheEntry<unknown>>();

const STORAGE_PREFIX = "stc:cache:";

const DEFAULT_TTL: Record<string, number> = {
  "student:": 3 * 60 * 1000,
  "admin:": 5 * 60 * 1000,
};

function getTTL(key: string, overrideMs?: number): number {
  if (overrideMs !== undefined) return overrideMs;
  for (const [prefix, ttl] of Object.entries(DEFAULT_TTL)) {
    if (key.startsWith(prefix)) return ttl;
  }
  return 5 * 60 * 1000;
}

function storageKey(key: string) {
  return `${STORAGE_PREFIX}${key}`;
}

function readStorage(key: string): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.sessionStorage.getItem(storageKey(key));
  } catch {
    return null;
  }
}

function writeStorage(key: string, value: string) {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(storageKey(key), value);
  } catch {
    // Fall back to in-memory only
  }
}

function removeStorage(key: string) {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.removeItem(storageKey(key));
  } catch {
    // Ignore
  }
}

export function getCached<T>(key: string, maxAgeMs?: number): T | null {
  const ttl = getTTL(key, maxAgeMs);
  const memEntry = cacheMemory.get(key) as CacheEntry<T> | undefined;
  if (memEntry && Date.now() - memEntry.savedAt <= ttl) {
    return memEntry.value;
  }

  const raw = readStorage(key);
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw) as CacheEntry<T>;
    if (Date.now() - parsed.savedAt > ttl) return null;
    cacheMemory.set(key, parsed);
    return parsed.value;
  } catch {
    return null;
  }
}

export function setCache<T>(key: string, value: T) {
  const entry: CacheEntry<T> = { value, savedAt: Date.now() };
  cacheMemory.set(key, entry);
  writeStorage(key, JSON.stringify(entry));
}

export function invalidateCache(prefix: string) {
  for (const key of cacheMemory.keys()) {
    if (key.startsWith(prefix)) {
      cacheMemory.delete(key);
      removeStorage(key);
    }
  }

  if (typeof window === "undefined") return;
  try {
    const keysToRemove: string[] = [];
    for (let i = 0; i < window.sessionStorage.length; i++) {
      const sKey = window.sessionStorage.key(i);
      if (sKey?.startsWith(`${STORAGE_PREFIX}${prefix}`)) {
        keysToRemove.push(sKey);
      }
    }
    for (const sKey of keysToRemove) {
      window.sessionStorage.removeItem(sKey);
    }
  } catch {
    // Ignore
  }
}

export function getCachedMemoryOnly<T>(key: string, maxAgeMs?: number): T | null {
  const ttl = getTTL(key, maxAgeMs);
  const memEntry = cacheMemory.get(key) as CacheEntry<T> | undefined;
  if (memEntry && Date.now() - memEntry.savedAt <= ttl) {
    return memEntry.value;
  }
  return null;
}

export function invalidateCacheKey(key: string) {
  cacheMemory.delete(key);
  removeStorage(key);
}
