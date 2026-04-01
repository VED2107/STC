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
import { useRouter } from "next/navigation";
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
}

/** Stable singleton — never changes between renders */
const supabase = createClient();

/**
 * Provides authentication state to the entire app.
 * Wraps Supabase auth listener + profile fetching.
 */
export function AuthProvider({ children }: AuthProviderProps) {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  /** Track previous user ID for cache cleanup on sign-out */
  const prevUserIdRef = useRef<string | null>(null);

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
    }
  }, [user, fetchProfile]);

  /** Sign out and redirect to home */
  const signOut = useCallback(async () => {
    try {
      // Clear the server session first, then clear the browser session.
      await fetch("/api/auth/logout", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
      }).catch(() => null);

      const { error: clientError } = await supabase.auth.signOut({ scope: "local" });

      if (clientError) {
        console.error("Client sign out error:", clientError.message);
      }

      const prevUserId = prevUserIdRef.current;
      if (prevUserId) {
        clearCachedProfile(prevUserId);
        clearCachedStudentType(prevUserId);
      }

      setUser(null);
      setProfile(null);
      setSession(null);
      router.replace("/login");
      router.refresh();
    } catch (err) {
      console.error("Sign out error:", err);
      router.replace("/login");
      router.refresh();
    }
  }, [router]);

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

        if (currentSession?.user) {
          const cachedProfile = getCachedProfile(currentSession.user.id);

          if (cachedProfile) {
            setProfile(cachedProfile);
            setLoading(false);
          }

          const p = await fetchProfile(currentSession.user.id);
          setProfile(p);
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
      setSession(newSession);
      setUser(newSession?.user ?? null);

      if (event === "SIGNED_IN" && newSession?.user) {
        prevUserIdRef.current = newSession.user.id;
        const cachedProfile = getCachedProfile(newSession.user.id);
        if (cachedProfile) {
          setProfile(cachedProfile);
          setLoading(false);
        } else {
          setLoading(true);
        }
        const p = await fetchProfile(newSession.user.id);
        setProfile(p);
        setLoading(false);
      }

      if (event === "SIGNED_OUT") {
        const prevUserId = prevUserIdRef.current;
        if (prevUserId) {
          clearCachedProfile(prevUserId);
          clearCachedStudentType(prevUserId);
        }
        prevUserIdRef.current = null;
        setProfile(null);
        setLoading(false);
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [fetchProfile]);

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
