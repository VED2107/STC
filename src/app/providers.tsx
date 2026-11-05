"use client";

import type { ReactNode } from "react";
import { FeedbackHost } from "@/components/ui/feedback";
import { AuthProvider } from "@/hooks/use-auth";
import type { Profile } from "@/lib/types/database";
import type { Session, User } from "@supabase/supabase-js";

// Chrome rejects a view transition started in a background tab, with wording React does
// not yet recognise. Throwing here makes React fall back to a plain update for that commit.
if (typeof document !== "undefined" && typeof document.startViewTransition === "function") {
  const startViewTransition = document.startViewTransition.bind(document);
  document.startViewTransition = ((...args: Parameters<typeof startViewTransition>) => {
    if (document.hidden) {
      throw new DOMException("Document is hidden", "InvalidStateError");
    }
    return startViewTransition(...args);
  }) as typeof document.startViewTransition;
}

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
  return (
    <AuthProvider initialAuth={initialAuth}>
      {children}
      <FeedbackHost />
    </AuthProvider>
  );
}
