import { ViewTransition, type ReactNode } from "react";

/**
 * Route transitions. Inside the app the content crossfades quickly, because people move
 * between pages all day. Public pages open with the slower sunrise wipe.
 * The rail, header, and tab bar carry their own names, so they stay still.
 * Browsers without View Transitions simply swap the page.
 */
export function PageTransition({ children, variant = "app" }: { children: ReactNode; variant?: "app" | "public" }) {
  return (
    <ViewTransition
      default="none"
      enter={variant === "public" ? "sun-in" : "page-in"}
      exit={variant === "public" ? "sun-out" : "page-out"}
    >
      {children}
    </ViewTransition>
  );
}
