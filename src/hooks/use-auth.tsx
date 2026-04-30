"use client";

import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  useCallback,
  type ReactNode,
} from "react";

import { createClient } from "@/lib/supabase/client";
import {
  clearCachedProfile,
  clearCachedStudentType,
  getCachedProfile,
  setCachedProfile,
} from "@/lib/auth/client-cache";
import type { Profile, UserRole } from "@/lib/types/database";
import type { AuthChangeEvent, Session, User } from "@supabase/supabase-js";

/** Auth context shape */
interface AuthContextType {
  user: User | null;
  profile: Profile | null;
  session: Session | null;
  role: UserRole | null;
  loading: boolean;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

interface AuthProviderProps {
  children: ReactNode;
  initialAuth?: {
    session: Session | null;
    user: User | null;
    profile: Profile | null;
  };
}

/** Stable singleton — never changes between renders */
const supabase = createClient();

/**
 * Provides authentication state to the entire app.
 * Wraps Supabase auth listener + profile fetching.
 */
export function AuthProvider({ children, initialAuth }: AuthProviderProps) {
  const [user, setUser] = useState<User | null>(initialAuth?.user ?? null);
  const [profile, setProfile] = useState<Profile | null>(initialAuth?.profile ?? null);
  const [session, setSession] = useState<Session | null>(initialAuth?.session ?? null);
  const [loading, setLoading] = useState(
    initialAuth ? Boolean(initialAuth.user && !initialAuth.profile) : true,
  );

  /** Track previous user ID for cache cleanup on sign-out */
  const prevUserIdRef = useRef<string | null>(initialAuth?.user?.id ?? null);

  /**
   * Keep a ref of the current profile so the onAuthStateChange listener
   * can check if profile is already loaded without triggering re-renders.
   */
  const profileRef = useRef<Profile | null>(initialAuth?.profile ?? null);

  /** Fetch profile from Supabase for the current user */
  const fetchProfile = useCallback(
    async (userId: string) => {
      try {
        const { data, error } = await supabase
          .from("profiles")
          .select("*")
          .eq("id", userId)
          .single();

        if (error) {
          console.error("Failed to fetch profile:", error.message);
          return null;
        }
        const profile = data as Profile;
        setCachedProfile(profile);
        return profile;
      } catch (err) {
        console.error("Profile fetch error:", err);
        return null;
      }
    },
    [],
  );

  /** Refresh the profile (useful after updates) */
  const refreshProfile = useCallback(async () => {
    if (user) {
      const p = await fetchProfile(user.id);
      setProfile(p);
      profileRef.current = p;
    }
  }, [user, fetchProfile]);

  /** Sign out and redirect to home */
  const signOut = useCallback(async () => {
    try {
      // Clear caches immediately so stale state never lingers
      const prevUserId = prevUserIdRef.current;
      if (prevUserId) {
        clearCachedProfile(prevUserId);
        clearCachedStudentType(prevUserId);
      }

      // Clear local state right away
      setUser(null);
      setProfile(null);
      profileRef.current = null;
      setSession(null);

      // Fire server-side session clear (don't block on it)
      fetch("/api/auth/logout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      }).catch(() => null);

      // Fire client-side sign out (don't await — it can hang on invalid sessions)
      supabase.auth.signOut({ scope: "local" }).catch(() => null);
    } catch {
      // swallow — we're redirecting anyway
    } finally {
      // Hard redirect that guarantees a full page reload
      window.location.replace("/");
    }
  }, []);

  useEffect(() => {
    if (initialAuth?.profile) {
      setCachedProfile(initialAuth.profile);
    }
  }, [initialAuth]);

  useEffect(() => {
    /** Get initial session */
    const getInitialSession = async () => {
      try {
        const {
          data: { session: currentSession },
        } = await supabase.auth.getSession();

        setSession(currentSession);
        setUser(currentSession?.user ?? null);
        prevUserIdRef.current = currentSession?.user?.id ?? null;

        if (!currentSession?.user) {
          setProfile(null);
          profileRef.current = null;
          return;
        }

        const currentUserId = currentSession.user.id;

        if (profileRef.current && prevUserIdRef.current === currentUserId) {
          setCachedProfile(profileRef.current);
          return;
        }

        if (currentSession?.user) {
          const cachedProfile = getCachedProfile(currentSession.user.id);

          if (cachedProfile) {
            setProfile(cachedProfile);
            profileRef.current = cachedProfile;
            setLoading(false);
          }

          const p = await fetchProfile(currentSession.user.id);
          setProfile(p);
          profileRef.current = p;
        }
      } catch (err) {
        console.error("Session fetch error:", err);
      } finally {
        setLoading(false);
      }
    };

    getInitialSession();

    /** Listen for auth state changes */
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event: AuthChangeEvent, newSession: Session | null) => {

      if (event === "SIGNED_OUT") {
        const prevUserId = prevUserIdRef.current;
        if (prevUserId) {
          clearCachedProfile(prevUserId);
          clearCachedStudentType(prevUserId);
        }
        prevUserIdRef.current = null;
        setUser(null);
        setProfile(null);
        profileRef.current = null;
        setSession(null);
        setLoading(false);
        return;
      }

      if (event === "SIGNED_IN" && newSession?.user) {
        prevUserIdRef.current = newSession.user.id;
        setSession(newSession);
        setUser(newSession.user);

        const cachedProfile = getCachedProfile(newSession.user.id);
        if (cachedProfile) {
          setProfile(cachedProfile);
          profileRef.current = cachedProfile;
          setLoading(false);
        } else {
          setLoading(true);
        }
        const p = await fetchProfile(newSession.user.id);
        setProfile(p);
        profileRef.current = p;
        setLoading(false);
        return;
      }

      // TOKEN_REFRESHED, USER_UPDATED, etc.
      // Update session and user but NEVER clear the profile.
      // The profile/role stays stable — no flickering.
      if (newSession?.user) {
        setSession(newSession);
        setUser(newSession.user);
        prevUserIdRef.current = newSession.user.id;

        // If profile isn't loaded yet (edge case), fetch it
        if (!profileRef.current) {
          const p = await fetchProfile(newSession.user.id);
          setProfile(p);
          profileRef.current = p;
          setLoading(false);
        }
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [fetchProfile, initialAuth]);

  const role = profile?.role ?? null;

  return (
    <AuthContext.Provider
      value={{ user, profile, session, role, loading, signOut, refreshProfile }}
    >
      {children}
    </AuthContext.Provider>
  );
}

/**
 * Hook to access auth state from any component.
 * Must be used within an <AuthProvider>.
 */
export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
