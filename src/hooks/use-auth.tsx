"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  type ReactNode,
} from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
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

  const supabase = createClient();

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
        return data as Profile;
      } catch (err) {
        console.error("Profile fetch error:", err);
        return null;
      }
    },
    [supabase]
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
      const { error } = await supabase.auth.signOut({ scope: "global" });
      if (error) {
        throw error;
      }
      setUser(null);
      setProfile(null);
      setSession(null);
      router.replace("/login");
      router.refresh();
      if (typeof window !== "undefined") {
        window.location.assign("/login");
      }
    } catch (err) {
      console.error("Sign out error:", err);
    }
  }, [supabase, router]);

  useEffect(() => {
    /** Get initial session */
    const getInitialSession = async () => {
      try {
        const {
          data: { session: currentSession },
        } = await supabase.auth.getSession();

        setSession(currentSession);
        setUser(currentSession?.user ?? null);

        if (currentSession?.user) {
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
        const p = await fetchProfile(newSession.user.id);
        setProfile(p);
      }

      if (event === "SIGNED_OUT") {
        setProfile(null);
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [supabase, fetchProfile]);

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
