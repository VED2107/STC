# STC Academy — Setup Guide

Quick setup for deploying STC Academy with your own domain, database, and hosting.

---

## Prerequisites

- **Node.js** 18+ and npm
- **Supabase** account (cloud) OR a self-hosted Supabase instance
- **Resend** account for transactional emails
- (Optional) **Razorpay** for payments
- (Optional) **Google Cloud** project for OAuth

---

## 1. Clone & Install

```bash
git clone <your-repo-url>
cd stc
npm install
```

## 2. Configure Environment

```bash
cp .env.example .env.local    # for local development
# OR
cp .env.example .env.production  # for production
```

### Option A — Supabase Cloud (easiest)

| Variable | Where to find it |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase Dashboard → Settings → API → URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase Dashboard → Settings → API → anon key |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase Dashboard → Settings → API → service_role key |
| `SUPABASE_URL` | **Leave empty** (not needed for cloud) |

### Option B — Self-hosted Supabase (Docker)

| Variable | Value |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Your public Supabase URL (e.g. `https://backend.yourdomain.com`) |
| `SUPABASE_URL` | Internal Docker URL (e.g. `http://supabase-kong:8000`) |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | From your Supabase `.env` file |
| `SUPABASE_SERVICE_ROLE_KEY` | From your Supabase `.env` file |

> **Important:** The `SUPABASE_URL` (internal) is only needed when your Next.js app runs inside the same Docker network as Supabase. It allows server-side API calls to go directly through the Docker network instead of the public internet.

### Common Settings

| Variable | Value |
|---|---|
| `NEXT_PUBLIC_SITE_URL` | Your site's public URL (e.g. `https://academy.yourdomain.com`) |
| `RESEND_API_KEY` | From [resend.com/api-keys](https://resend.com/api-keys) |
| `RESEND_FROM_EMAIL` | `Your Academy <noreply@yourdomain.com>` — domain must be verified in Resend |

## 3. Set Up the Database

Run the migration SQL against your Supabase database:

```bash
# Using Supabase CLI
supabase db push

# OR paste the contents of supabase/migration.sql into:
# Supabase Dashboard → SQL Editor → New query → Run
```

## 4. Run Locally

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

## 5. Deploy to Production

### Build & Start

```bash
npm run build
npm start
```

### With Docker

Create a `Dockerfile`:

```dockerfile
FROM node:18-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:18-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public
EXPOSE 3000
CMD ["node", "server.js"]
```

### With Vercel / Railway / Coolify

Just connect your Git repo and set the environment variables in the dashboard.

---

## 6. Google OAuth (Optional)

### A. Create Google OAuth Credentials

1. Go to [Google Cloud Console → Credentials](https://console.cloud.google.com/apis/credentials)
2. Create an **OAuth 2.0 Client ID** (Web application)
3. Set:
   - **Authorized JavaScript Origins:** `https://your-site-domain.com`
   - **Authorized Redirect URI:** `https://your-supabase-domain.com/auth/v1/callback`

### B. Configure Supabase

**Supabase Cloud:**
- Dashboard → Authentication → Providers → Google
- Enter Client ID and Client Secret
- Set Site URL to your site domain
- Add `https://your-site-domain.com/**` to Redirect URLs

**Self-hosted Supabase:**
Set these env vars on the `supabase-auth` container:

```env
GOTRUE_EXTERNAL_GOOGLE_ENABLED=true
GOTRUE_EXTERNAL_GOOGLE_CLIENT_ID=your-client-id
GOTRUE_EXTERNAL_GOOGLE_SECRET=your-client-secret
GOTRUE_SITE_URL=https://your-site-domain.com
GOTRUE_URI_ALLOW_LIST=https://your-site-domain.com/**
```

Then restart: `docker restart supabase-auth`

---

## 7. Razorpay Payments (Optional)

1. Create account at [razorpay.com](https://razorpay.com)
2. Dashboard → Settings → API Keys → Generate
3. Set `RAZORPAY_KEY_ID` and `RAZORPAY_KEY_SECRET` in your `.env`

---

## Environment Files Reference

| File | Purpose | Git tracked? |
|---|---|---|
| `.env.example` | Template with all variables documented | ✅ Yes |
| `.env.local` | Local development values | ❌ No |
| `.env.production` | Production deployment values | ❌ No |

---

## Architecture Overview

```
Browser  ──→  Next.js App  ──→  Supabase (API + Auth + Storage + DB)
                  │
                  ├── /api/auth/*        Server-side auth (OTP, signup)
                  ├── /auth/callback     OAuth redirect handler
                  └── /api/*             Other API routes
```

**Key design decisions:**
- All server-side code uses `SUPABASE_URL` (internal Docker URL) when available, falling back to `NEXT_PUBLIC_SUPABASE_URL` (public URL). This avoids routing through reverse proxies for internal calls.
- The browser client always uses `NEXT_PUBLIC_SUPABASE_URL` (public URL).
- OTP encryption uses `SUPABASE_SERVICE_ROLE_KEY` as the secret — both send and verify must use the same key.
