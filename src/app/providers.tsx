"use client";

import type { ReactNode } from "react";
import { AuthProvider } from "@/hooks/use-auth";
import type { Profile } from "@/lib/types/database";
import type { Session, User } from "@supabase/supabase-js";

interface ProvidersProps {
  children: ReactNode;
  initialAuth?: {
    session: Session | null;
    user: User | null;
    profile: Profile | null;
  };
}

/**
 * Client-side providers wrapper.
 * Wraps the app in AuthProvider (and any future providers).
 */
export function Providers({ children, initialAuth }: ProvidersProps) {
  return <AuthProvider initialAuth={initialAuth}>{children}</AuthProvider>;
}
