# GENIUSS Clone Playbook — spin up a branded voice-HUD assistant in < 1 day

A repeatable recipe to stamp out a new white-label voice assistant for a client,
reusing this exact stack (React + Vite + Tailwind + framer-motion HUD, Web Audio
mic-reactive reactor, Web Speech STT, a serverless Anthropic tool-use brain over
Supabase, ElevenLabs TTS, Vercel deploy).

## 1. The seams to parameterize (everything per-client lives here)

| Knob | Where it lives today | Notes |
|---|---|---|
| **Brand name** | `client/src/components/genius/GeniusHUD.tsx` (header/labels), `client/src/pages/Admin.tsx` header, doc `<title>` in `src/routes`/index | The AI's self-name also lives in the system prompt (below). |
| **Accent color / theme** | Reactor draws gold `#D4AF37`; recolored at runtime by a CSS `hue-rotate` wrapper in `Admin.tsx` (the swatch picker writes `geniuss.hueDeg`). "Rainbow while talking" = `.geniuss-rainbow` class. | To make color a true one-knob brand input, centralize on a single hex/HSL and drive both the canvas base color and the wrapper. |
| **Voice (ElevenLabs)** | `server/handlers/tts.ts` — `BRITISH_DANIEL`/`BRITISH_GEORGE` + `ALLOWED_VOICES`; default overridable via env `ELEVENLABS_VOICE_ID`. | Cloned voice = add the client's ElevenLabs voice id to the allow-list + set the env default. |
| **Persona / system prompt** | `server/handlers/genius-chat.ts` → `SYSTEM_PROMPT` (name, tone, "sir", reply length, safety rules). | The single biggest personality lever. |
| **Brain / data source** | `server/handlers/genius-chat.ts` tools `query_database`→`geniuss_read`, `write_database`→`geniuss_write`; the **schema block** in `SYSTEM_PROMPT`; Supabase project via `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY`. | Per client: point at their Supabase, paste their schema into the prompt, re-create the two `geniuss_read/write` SQL bridges (service-role only). |
| **Auth / owner gating** | `ADMIN_USER_ID` env + Supabase Auth (Google). All admin endpoints check `getUserFromRequest === ADMIN_USER_ID`. | Per client: their Supabase Auth + their admin user id. |
| **Deploy** | Vercel project; **keep ≤12 serverless functions** (Hobby) via the `/api/admin?fn=…` router in `vercel.json` + `server/handlers/`. | Pro plan removes the cap. |

## 2. Single config object (the highest-leverage refactor)

There is no central config today (values are scattered per the table above). Add
`client/src/lib/clientConfig.ts` + a server mirror and read everything from it:

```ts
export interface ClientConfig {
  brandName: string;          // "GENIUSS"
  companyName: string;        // "Chamillion Collective"
  accentHex: string;          // "#D4AF37" — drives reactor + hue-rotate
  rainbowWhileTalking: boolean;
  voiceId: string;            // ElevenLabs voice id (ENV: ELEVENLABS_VOICE_ID)
  persona: string;            // system-prompt personality block
  schemaDoc: string;          // DB schema pasted into the brain prompt
  greeting: string;           // "GENIUSS online, sir."
}
```
Server-only (env, never in the bundle): `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`,
`ADMIN_USER_ID`, `ANTHROPIC_API_KEY`, `ELEVENLABS_API_KEY`.

## 3. Clone checklist (target < 1 day)

1. **Fork the repo / template** — 10 min.
2. **Provision Supabase** (client's or new) → run the `geniuss_read`/`geniuss_write` migration (service-role only) + RLS on exposed tables → 30 min.
3. **Fill `clientConfig.ts`** (brand, accent, greeting) + paste the client's **DB schema** into `persona`/`schemaDoc` → 45 min.
4. **Voice**: pick/clone an ElevenLabs voice, add its id to `ALLOWED_VOICES`, set `ELEVENLABS_VOICE_ID` → 20 min (clone: +30).
5. **Auth**: set `ADMIN_USER_ID` to the client's admin Supabase user → 10 min.
6. **Deploy to Vercel**: set env vars for **Preview + Production**, confirm ≤12 functions, push `main` → 30 min.
7. **Smoke test** by voice: a read ("how many users?"), a guarded write (confirm flow), the reactor reacting → 30 min.
8. **Brand QA**: color, name, greeting, voice → 20 min.

## 4. Reusable vs. per-client custom

- **100% reusable:** the whole HUD/reactor (`GeniusHUD`, `ReactorCore`, `useReactorAudio`), the STT/TTS loop, the tool-use brain engine, the `geniuss_read/write` bridge pattern, the `/api/admin` consolidation, deploy flow.
- **Per-client (all in the config + env):** brand, accent, voice, persona, the **schema doc** + which tables/writes are allowed, Supabase project, admin id.
- **Occasionally custom:** bespoke tools beyond raw SQL (e.g., "send invoice", "text a customer") — add as new Anthropic tools in `genius-chat.ts`; this is the paid "extra integration" upsell.

## 5. Gotchas

- **Mic permission**: the analyser uses `getUserMedia`; first use prompts. Fails closed (reactor falls back to the synthetic pulse) — never blocks the UI.
- **Vercel 12-function Hobby cap**: each `api/*.ts` counts. Keep admin endpoints behind the single `/api/admin` router (see `vercel.json` rewrites + `server/handlers/`), or upgrade to Pro.
- **Env per environment**: set client + server vars for **Preview AND Production** or the preview silently breaks (client Supabase needs `VITE_*` at build time).
- **Data security**: `geniuss_read/write` are **SECURITY DEFINER, service-role only** — never grant to `anon`/`authenticated`. Never select secret columns (api keys, stripe ids) — the system prompt forbids it; back it with column-level care for high-trust clients.
- **Voice licensing**: ElevenLabs voice cloning requires consent of the voice owner; bill the minutes (it's your COGS).
- **Write safety**: keep the spoken-confirmation gate on credit/tier/billing/delete writes; it's a feature, not a limitation — demo it.

---
*The durable advantage is speed-to-deploy: once `clientConfig.ts` exists, a new branded assistant is a config file + a Supabase migration + a deploy.*
