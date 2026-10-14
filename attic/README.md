# Attic - retired, do not import or deploy from here

## api-legacy/ → moved back to `api/` (14 Oct 2026)
The Vercel serverless functions now serve `/api` again (Phase 1), because
there is no backend host and no `api.medconnect.app` DNS record — the Ktor
server in `server/` has nowhere to run yet. The old claim below that Ktor is
"live at api.medconnect.app" was never true; do not trust it.

**Current split (until Ktor gets a host):**
- Production API = `api/*.js` on Vercel (legacy contract: auth, qbank tracker,
  decks, notes, blocks, logbook, partners, messages, reset-links, stats).
- `server/` (Kotlin/Ktor, migrations V1–V9) is the future canonical backend:
  adds mcq answers/shares, goals/minutes, daily content, presence, resources,
  OTP reset. Deploy it to a JVM host, create the DNS, then point clients at it.

## Known gaps of the Phase-1 API (fixed properly by the Ktor deploy)
1. Password reset is token-link based; the mobile app speaks OTP codes, so
   in-app reset stays broken until Ktor ships.
2. No `/mcq`, `/goals`, `/daily`, `/presence`, `/resources` endpoints — the
   app covers these with real local fallbacks until then.
