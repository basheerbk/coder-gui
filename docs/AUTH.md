# TinkerBit Google Sign-In

The IDE is gated behind Google OAuth. Guests who open `/ide` are redirected to `/login`.

## Setup

1. Create a Google Cloud **OAuth 2.0 Web client**.
2. Authorized redirect URIs:
   - `https://www.tinkerbit.io/api/auth/callback`
   - `http://127.0.0.1:3000/api/auth/callback` (local `vercel dev`)
3. Copy `.env.example` → `.env.local` (never commit secrets).
4. Set Vercel project env vars:
   - `GOOGLE_CLIENT_ID`
   - `GOOGLE_CLIENT_SECRET`
   - `AUTH_SECRET` (32+ random characters)
   - `AUTH_BASE_URL=https://www.tinkerbit.io`
   - `CLARITY_ID` (Microsoft Clarity project ID; optional)

## Local

Auth APIs + middleware need Vercel:

```bash
npx vercel env pull .env.local
npx vercel dev
```

`npm start` (webpack-dev-server) alone does **not** run middleware. On localhost it will warn and continue if `/api/auth` is unreachable. For a real login test, use `vercel dev`.

Optional non-production bypass: `AUTH_DISABLED=1` (ignored when `VERCEL_ENV=production`).

## Routes

| Path | Purpose |
|------|---------|
| `/login` | Sign-in page |
| `/api/auth/google` | Start Google OAuth |
| `/api/auth/callback` | OAuth callback → session cookie |
| `/api/auth/me` | Current user JSON |
| `/api/auth/logout` | Clear session |

Session cookie: `tb_session` (httpOnly, SameSite=Lax, Secure in production).

## Clarity

When `CLARITY_ID` is set, sessions are tagged with `page` (`landing` / `login` / `ide`), signed-in users are identified (hashed), and custom events fire for sign-in, board select/connect, and upload outcomes.
