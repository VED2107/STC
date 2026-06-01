import { getCached, getCachedMemoryOnly, setCache } from "./dashboard-cache";

export function getAdminPageCache<T>(key: string, maxAgeMs = 5 * 60 * 1000): T | null {
  return getCachedMemoryOnly<T>(key, maxAgeMs);
}

export function getAdminPageStorageCache<T>(key: string, maxAgeMs = 5 * 60 * 1000): T | null {
  return getCached<T>(key, maxAgeMs);
}

export function setAdminPageCache<T>(key: string, value: T) {
  setCache(key, value);
}
