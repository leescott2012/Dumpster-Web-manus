# Dumpster Instagram Scan (Apify actor)

Our own actor on Apify (account `geniussscott`, actor id `Zj1CthOiflFEQ6hnM`). One run = scrape a profile with
`apify/instagram-scraper`, normalize + rank posts, compute formats and best posting times, retry on timeout.

Used by `api/ig-scrub.ts` (profile scan). If this actor fails, the route falls back to calling
`apify/instagram-scraper` directly. Override the actor with env `APIFY_PROFILE_ACTOR` (`off` disables it).

Cost per run (verified on Apify, 2026-10-21): about $0.001 for this actor plus the underlying scraper
(about $0.0025 per post returned).

## Deploy / update
Apify's web editor only keeps files you have opened. Easiest: `python3 -m http.server` (with CORS) over this folder,
open each file in the Apify Source editor, replace its content, Save & build. Files: `package.json`,
`Dockerfile`, `.actor/actor.json`, `.actor/input_schema.json`, `src/main.js`, `src/lib.js`.

## Test
`npm test` (runs `test.js`, no Apify needed).
