# TinkerBit Google Sign-In

The IDE and mode pages are gated behind Google OAuth. Guests who open `/choose`, `/beginner`, or `/ide` are redirected to `/login`.

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
| `/choose` | Post-login Beginner / Advanced chooser |
| `/beginner` | Beginner Studio — visual RJ11 wiring + click blocks + live Arduino C++ |
| `/ide` | Full (Advanced) OpenBlock IDE with upload |
| `/api/auth/google` | Start Google OAuth |
| `/api/auth/callback` | OAuth callback → session cookie → `/choose` by default |
| `/api/auth/me` | Current user JSON |
| `/api/auth/logout` | Clear session |

After sign-in, users land on `/choose`. **Advanced** opens `/ide`. **Beginner** opens `/beginner` (React wiring + block codegen studio; no Scratch VM on that route).

Session cookie: `tb_session` (httpOnly, SameSite=Lax, Secure in production).

## Clarity

When `CLARITY_ID` is set, sessions are tagged with `page` (`landing` / `login` / `choose` / `beginner` / `ide`), signed-in users are identified (hashed), and custom events fire for sign-in, mode choice, board select/connect, and upload outcomes. Beginner Studio also fires `beginner_ide_opened`.
