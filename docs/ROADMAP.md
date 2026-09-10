# Web MVP Master Plan

## Core philosophy

- **Manifesto:** "We don't do emotions. We do math."
- **Two-way truth:** Candidates prove skills via Git commits. Companies prove
  hiring intent via action metrics.
- **Radical transparency:** Ghost jobs, black holes, and bait-and-switch tactics
  are exposed by automated algorithms.
- **Equal access:** No premium tiers. No pay-to-message. No VIP treatment.

## Architectural rules

These are binding. A change that violates one is a bug, not a trade-off.

1. **No traditional backend.** The SvelteKit app is 100% static. No Node/Express/
   Python server in this repo.
2. **Git as a database.** All data (profiles, jobs, events) is JSON/JSONL in
   GitHub repositories.
3. **Static hosting.** `@sveltejs/adapter-static`, SSR disabled
   (`export const ssr = false`), hosted on GitHub Pages.
4. **Client-side math.** Ghost Job scoring and Black Hole detection run in the
   browser.
5. **ODS modularity.** Features live in `src/extensions/` with `manifest.yaml`.
   `src/core/` handles only routing, auth, and state.
6. **Auth.** GitHub OAuth Device Flow. No client secrets in the frontend.
7. **Payments.** External Cloudflare Worker. The app only receives and verifies
   a signed receipt.

---

## Phase 1: Foundation & landing page

- [x] **1.1** SvelteKit + TypeScript + TailwindCSS + `adapter-static`
- [x] **1.2** Core layout: shell, nav, theme toggle, ODS auto-discovery
- [x] **1.3** Landing page: hero, features, CTA
- [x] **1.4** 404 fallback for GitHub Pages SPA routing

## Phase 2: Auth & core infrastructure

- [x] **2.1** GitHub OAuth Device Flow (`src/core/auth/`)
- [x] **2.2** GitHub API wrapper with ETag caching (`src/core/github-api/`)
- [x] **2.3** Dexie/IndexedDB local cache (`src/core/db/`)

## Phase 3: Candidate experience

- [ ] **3.1** Ship Logs profile: repos, commit history, verified skills, merged-PR timeline
- [ ] **3.2** Job board: exact salaries, tech stacks, transparency badges
- [ ] **3.3** Black Hole Tracker: application states, 14-day flag, Black Hole Squad count
- [ ] **3.4** Async encrypted messaging: requests, polling, no WebSockets

## Phase 4: Company experience

- [ ] **4.1** Job creation form: exact salary, client-side repost warning
- [ ] **4.2** Payment handshake: Worker → Stripe → signed receipt → commit
- [ ] **4.3** Company dashboard: Ghost Score meter, action nudges, close reasons

## Phase 5: The math engine

- [x] **5.1** Ghost Score (`src/core/math-engine/ghost-score.ts`)
- [x] **5.2** Black Hole detection (`src/core/math-engine/black-hole.ts`)
- [x] **5.3** Repost/evergreen detector (`src/core/math-engine/similarity.ts`)

## Phase 6: Polish & deployment

- [x] **6.1** GitHub Actions CI/CD
- [x] **6.2** Domain configuration: apex `pointbreaklab.com`, see [DEPLOYMENT.md](DEPLOYMENT.md)
- [x] **6.3** PWA manifest + service worker

---

## Ghost Score rules

Implemented verbatim in `src/core/math-engine/ghost-score.ts`. Clamped to 0–100.

| Δ | Condition |
|---|---|
| +20 | Open > 30 days with 0 interviews and 0 rejections |
| +30 | Identical description reposted more than twice |
| +20 | More than 100 applications with 0 interviews |
| −5 | Per interview scheduled |
| −1 | Per rejection sent |

## Black Hole detection

`last_action_at` older than 14 days while status is `submitted` or `viewed`.

---

## Open questions

Decisions the plan leaves ambiguous. Resolve before Phase 6.2.

1. ~~**Domain split.**~~ **Resolved:** one origin on the apex,
   `pointbreaklab.com`. Landing at `/`, app at `/app/*`. Same-origin is required
   because the session token, Dexie cache, and service worker are all
   origin-scoped. `app.pointbreaklab.com` becomes a provider-level 301, not a
   Pages hostname. See [DEPLOYMENT.md](DEPLOYMENT.md).
2. ~~**Landing page indexability.**~~ **Resolved:** rule 3 stands, SSR stays off
   everywhere. Accepted cost: the landing page is a JS-hydrated shell, so
   non-JS crawlers, link previews, and LLM scrapers read nothing from it.
   Revisit if organic discovery matters later. Prerendering only `/` would fix
   it without introducing a server.
3. ~~**Data schemas.**~~ **Resolved:** the inferred `job.json`, application
   event, and `receipt.json` shapes in `src/lib/types.ts` are approved.
4. ~~**Deploy mechanism.**~~ **Resolved:** `actions/deploy-pages` artifact flow.
5. **Badge thresholds.** 🟢/🟡/🔴 cutoffs weren't given. Currently
   `<30 / 30–59 / ≥60`.
6. **`post-job` route.** The directory tree puts it at `/app/post-job`; §4.1 puts it
   at `/app/app/post-job`. Currently at `/app/post-job`.
