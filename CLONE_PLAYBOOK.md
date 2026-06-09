Created `/Users/leescott/Desktop/photos/dumpster-web/CLONE_PLAYBOOK.md` (~640 words, skimmable, all 5 sections).

Seams are keyed to real code, not invented:
- Persona/`SYSTEM_PROMPT` — `server/handlers/genius-chat.ts:17`
- Accent theme — `--accent`/`--accent-rgb` at `client/src/index.css:60-61` (everything reads `var(--accent)`)
- Voice — `BRITISH_DANIEL` + `ALLOWED_VOICES`, `server/handlers/tts.ts:22-34`; env `ELEVENLABS_VOICE_ID`
- Brain tools — `geniuss_read`/`geniuss_write` RPCs, `genius-chat.ts:156-159`
- Owner gating — `IS_OWNER` from `@/lib/photoData`, route at `client/src/App.tsx:19`
- Deploy/12-fn cap — real `/api/admin?fn=…` consolidation in `vercel.json`

The playbook's one prescriptive addition is centralizing those scattered seams into a new `client/src/lib/clientConfig.ts` (section 2 schema), since the grep confirmed no central config exists today — that's the highest-leverage change to hit the under-a-day target.
