"use client";

import type { ReactNode } from "react";
import { AuthProvider } from "@/hooks/use-auth";

interface ProvidersProps {
  children: ReactNode;
}

/**
 * Client-side providers wrapper.
 * Wraps the app in AuthProvider (and any future providers).
 */
export function Providers({ children }: ProvidersProps) {
  return <AuthProvider>{children}</AuthProvider>;
}
