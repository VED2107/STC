import type { Profile, StudentType, UserRole } from "@/lib/types/database";

const profileMemory = new Map<string, Profile>();
const studentTypeMemory = new Map<string, StudentType>();

const profileStorageKey = (userId: string) => `stc:profile:${userId}`;
const studentTypeStorageKey = (userId: string) => `stc:student-type:${userId}`;

function readStorage(key: string) {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    return window.sessionStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeStorage(key: string, value: string) {
  if (typeof window === "undefined") {
    return;
  }

  try {
    window.sessionStorage.setItem(key, value);
  } catch {
    // Ignore storage write failures and fall back to in-memory cache only.
  }
}

function removeStorage(key: string) {
  if (typeof window === "undefined") {
    return;
  }

  try {
    window.sessionStorage.removeItem(key);
  } catch {
    // Ignore storage cleanup failures.
  }
}

export function getCachedProfile(userId: string): Profile | null {
  const cached = profileMemory.get(userId);
  if (cached) {
    return cached;
  }

  const raw = readStorage(profileStorageKey(userId));
  if (!raw) {
    return null;
  }

  try {
    const parsed = JSON.parse(raw) as Profile;
    profileMemory.set(userId, parsed);
    return parsed;
  } catch {
    removeStorage(profileStorageKey(userId));
    return null;
  }
}

export function setCachedProfile(profile: Profile) {
  profileMemory.set(profile.id, profile);
  writeStorage(profileStorageKey(profile.id), JSON.stringify(profile));
}

export function clearCachedProfile(userId?: string) {
  if (userId) {
    profileMemory.delete(userId);
    removeStorage(profileStorageKey(userId));
    return;
  }

  profileMemory.clear();
}

export function getCachedRole(userId: string): UserRole | null {
  return getCachedProfile(userId)?.role ?? null;
}

export function getCachedStudentType(userId: string): StudentType | null {
  const cached = studentTypeMemory.get(userId);
  if (cached) {
    return cached;
  }

  const raw = readStorage(studentTypeStorageKey(userId));
  if (raw === "tuition" || raw === "online") {
    studentTypeMemory.set(userId, raw);
    return raw;
  }

  return null;
}

export function setCachedStudentType(userId: string, studentType: StudentType) {
  studentTypeMemory.set(userId, studentType);
  writeStorage(studentTypeStorageKey(userId), studentType);
}

export function clearCachedStudentType(userId?: string) {
  if (userId) {
    studentTypeMemory.delete(userId);
    removeStorage(studentTypeStorageKey(userId));
    return;
  }

  studentTypeMemory.clear();
}
