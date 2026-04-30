type CacheEntry<T> = {
  value: T;
  savedAt: number;
};

const adminCacheMemory = new Map<string, CacheEntry<unknown>>();

function storageKey(key: string) {
  return `stc:admin-cache:${key}`;
}

function readStorage(key: string) {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    return window.sessionStorage.getItem(storageKey(key));
  } catch {
    return null;
  }
}

function writeStorage(key: string, value: string) {
  if (typeof window === "undefined") {
    return;
  }

  try {
    window.sessionStorage.setItem(storageKey(key), value);
  } catch {
    // Ignore storage write failures and fall back to in-memory cache.
  }
}

export function getAdminPageCache<T>(key: string, maxAgeMs = 5 * 60 * 1000): T | null {
  const memoryEntry = adminCacheMemory.get(key) as CacheEntry<T> | undefined;
  if (memoryEntry && Date.now() - memoryEntry.savedAt <= maxAgeMs) {
    return memoryEntry.value;
  }
  return null;
}

export function getAdminPageStorageCache<T>(key: string, maxAgeMs = 5 * 60 * 1000): T | null {
  const memoryEntry = adminCacheMemory.get(key) as CacheEntry<T> | undefined;
  if (memoryEntry && Date.now() - memoryEntry.savedAt <= maxAgeMs) {
    return memoryEntry.value;
  }

  const raw = readStorage(key);
  if (!raw) {
    return null;
  }

  try {
    const parsed = JSON.parse(raw) as CacheEntry<T>;
    if (Date.now() - parsed.savedAt > maxAgeMs) {
      return null;
    }
    adminCacheMemory.set(key, parsed);
    return parsed.value;
  } catch {
    return null;
  }
}

export function setAdminPageCache<T>(key: string, value: T) {
  const entry: CacheEntry<T> = {
    value,
    savedAt: Date.now(),
  };

  adminCacheMemory.set(key, entry);
  writeStorage(key, JSON.stringify(entry));
}
