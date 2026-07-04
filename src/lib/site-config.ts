/**
 * Single source of truth for the site's public origin.
 * Set NEXT_PUBLIC_SITE_URL in .env.local / Vercel project env vars.
 * Falls back to localhost only when unset (local dev without env configured).
 */
export const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
