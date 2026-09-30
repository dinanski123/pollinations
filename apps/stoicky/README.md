# Stoicky

Stoicky is a standalone React/Vite AI video studio designed for Cloudflare Pages and Pollinations.

## Cloudflare Pages

- Root directory: `apps/stoicky`
- Build command: `npm run build`
- Output directory: `dist`
- Node version: `22`

The `functions/` directory is deployed as Cloudflare Pages Functions.

## Pollinations Connect

Stoicky uses Pollinations Connect User Wallets (BYOP) instead of asking users to paste a secret API key.

1. Create an App Key at `https://enter.pollinations.ai/keys`.
2. Register `https://stoicky.pages.dev/callback` as a Redirect URI.
3. Put the resulting `pk_...` App Key into Stoicky Settings.
4. Click **Connect Pollinations**.
5. The OAuth authorization-code flow uses PKCE.
6. Pollinations returns a temporary user-authorized `sk_...` token.
7. The token is kept in `sessionStorage` and sent to the same-origin Cloudflare Functions for generation.

The App Key is publishable. Do not commit or expose a personal secret `sk_...` key.

The current OAuth request asks for the script and video models used by Stoicky, a 7-day authorization expiry, and a 25 Pollen budget. Users review the authorization before it is granted.

## Generation flow

1. Pollinations text generation creates a structured short-form script.
2. Stoicky combines the scene direction into a video prompt.
3. Pollinations `google/veo-3.1-fast` generates the video.
4. The result is shown in the Projects view.

Video generation is synchronous and can take a few minutes.

## Private deployment option

A private deployment can still provide `POLLINATIONS_API_KEY` as a Cloudflare Pages secret. The API Functions support that server-side fallback, but public Stoicky usage should use Pollinations Connect so each user authorizes their own Pollen budget.

## Local development

```bash
cd apps/stoicky
npm install
npm run dev
```

For local OAuth, register:

`http://localhost:5173/callback`

with the Pollinations App Key.

## Current limitation

The MVP generates one Pollinations video from the combined scene direction. It does not yet stitch separate per-scene clips into a longer multi-shot timeline or persist binary video output in object storage.
