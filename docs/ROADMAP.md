# Roadmap

Implementation status. The specification itself lives in [PRD.md](PRD.md), which
wins wherever the two disagree.

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
7. **Payments.** External ledger service. The app only receives and verifies
   a signed receipt.

---

## Phase 1: Foundation & landing page

- [x] **1.1** SvelteKit + TypeScript + TailwindCSS + `adapter-static`
- [x] **1.2** Core layout: shell, nav, theme toggle, ODS auto-discovery
- [x] **1.3** Landing page: hero, features, CTA
- [x] **1.4** 404 fallback for GitHub Pages SPA routing

## Phase 2: Auth & core infrastructure

- [x] **2.1** Sign-in. Pasted fine-grained token. Device Flow cannot work from a
      browser, see [PRD section 4b](PRD.md)
- [x] **2.2** GitHub API wrapper with ETag caching (`src/core/github-api/`)
- [x] **2.3** Dexie/IndexedDB local cache (`src/core/db/`)

## Phase 3: Candidate experience

- [x] **3.1** Ship Logs profile: repos, commit history, verified skills, merged-PR timeline
- [x] **3.2** Job board: salaries, tech stacks, transparency badges, external postings (fixture-backed)
- [x] **3.3** Black Hole Tracker: states, 14-day flag, Squad count, claim attestation, external logging (fixture-backed)
- [~] **3.4** Async encrypted messaging. Inbox UI renders its empty state. No key
      exchange, no polling, no data source, no commit path

## Phase 4: Company experience

- [~] **4.1** Job creation form. UI done: exact salary rejected when the band is
      wider than 25% of its midpoint, live Jaccard repost warning. Not wired: it
      cannot submit, because 4.2 is not built
- [ ] **4.2** Payment handshake. Nothing built. The service has a Stripe webhook
      stub that verifies signatures and does nothing else
- [~] **4.3** Company dashboard. Renders: posting switcher, Ghost Score meter,
      rule breakdown, action nudges, pseudonymous applicant list, close reasons.
      Fixture-backed, and closing a posting does not write anything. Company
      claiming does not exist, so it shows demonstration postings rather than
      yours

## Phase 5: The math engine

- [x] **5.1** Ghost Score (`src/core/math-engine/ghost-score.ts`)
- [x] **5.2** Black Hole detection (`src/core/math-engine/black-hole.ts`)
- [x] **5.3** Repost/evergreen detector (`src/core/math-engine/similarity.ts`)

## Phase 6: Polish & deployment

- [x] **6.1** GitHub Actions CI/CD
- [~] **6.2** Domain. DNS is done: all four A records resolve to GitHub Pages.
      The Pages custom domain is **not set**, so the site still serves from
      `github.io/pointbreak-network/`. Setting it also means clearing
      `PUBLIC_BASE_PATH`, see [DEPLOYMENT.md](DEPLOYMENT.md)
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

Key: `[x]` done, `[~]` partly done, `[!]` built but broken, `[ ]` not started.

## Current mode: local only

Writes land in IndexedDB and are not published. `PUBLIC_PUBLISH_LEDGER` is
`false`, so the ledger service is not required and does not need deploying.

This is deliberate rather than unfinished. With one user a shared ledger
computes nothing a local one cannot: squad counts and company scores need
several people logging the same posting. Turning publishing on is a repository
variable plus a deployed Worker, and the code path is already written and
type-checked.

What works today with no server at all: logging applications from any source,
tracking silence, attesting to claims, ghost scoring, and the whole read side.
What is illustration rather than real data: squad counts and company scores,
which come from the fixture ledger.

What you lose without publishing: your history lives in one browser. Export from
the tracker keeps a copy.

## Resolved since the design review

- **Aggregate indexer.** `index/network.json` in the data repo bundles jobs,
  events and companies, rebuilt by a workflow on every ledger change and served
  from raw.githubusercontent.com: one request, no token, works signed out. The
  client falls back to walking the directories if it is missing, and to
  IndexedDB if the network is unreachable. Fixtures now appear only when the
  ledger is genuinely empty, labelled as demonstration data. Verified by putting
  a job in the ledger and watching it become a scored posting in a browser.

- **Data repo exists.** `pointbreaklab-hub/pointbreak-data`, seeded with the
  layout and the write policy.
- **Ledger writes go to Git.** Through the ledger service, because a Git commit carries
  its author and a candidate committing their own application would deanonymise
  every pseudonymous ref. See PRD section 4a.
- **Sybil resistance.** One token per account per posting, a minimum account
  age, a monthly budget, and single-use tokens. Squad counts are no longer free
  to manufacture.
- **Peer attestation.** Implemented with credibility inherited from the
  voucher's GitHub-attested footprint, so vouch rings produce zero. Run
  `npm run scenario:attestation` for the worked example.

## Phase 7: Identity and portfolio

Specified in [PRD section 9](PRD.md). Nothing built. Three decisions marked OPEN
there change the data model and should be settled first.

- [ ] **7.1** Domain verification. Employment expires into a dated record;
      education does not, because the claim is past tense. Neither counts
      toward skill
- [ ] **7.2** Company claiming, which falls out of 7.1 and is what makes the
      company dashboard real rather than fixture-backed
- [x] **7.3** CV upload, parse and correct. Parsed in the browser, file never
      uploaded, contact details stripped before storage
- [x] **7.4** Portfolio themes: Series, Plain, Tinted, over one canonical format
- [x] **7.5** Visibility. Public and hidden are enforceable end to end: public
      writes `users/<login>/portfolio.json`, hidden removes it. Specific people
      and hiring managers stay disabled with the reason shown
- [~] **7.6** Public portfolio pages at `/u/<login>`, readable signed out. Not
      prerendered, so title and description are set after hydration and a
      crawler that does not run JavaScript sees nothing. Fixing that needs a
      build per profile

## Not yet built

- **3.4** Async encrypted inbox. UI renders; no key exchange, no polling, no
  commit path.
- **Phase 4** Payment handshake and company dashboard wiring. Components render
  from props only.
- **Zero-trust reporting** (PRD section 6). The ledger it audits exists, is
  append only, and claim disputes are implemented. Still missing: report
  submission, the audit routine, and the dismissal path.
- **Blind-signed append tokens.** Issuance and append are split so the ledger service
  never sees a login and a ref in one request, but not correlating them across
  requests is an operational promise rather than a proof. A blind signature
  scheme would make it one.
- **Private ref backup.** Application refs live only in IndexedDB. Clearing site
  data loses tracker history. Needs an opt-in private repo backup.
- **Company claim route.** Companies cannot yet append claims at all. The
  append route deliberately rejects them, so there is nothing for candidates to
  attest except fixtures.
- **Worker deployment.** `server/.env` needs a real KV namespace id and
  five secrets before it will deploy. Until then every ledger write fails
  closed with a visible error, which is the correct behaviour but not a working
  one.
- **Sharding the index.** One bundled file is fine at hundreds of records and
  will not be at hundreds of thousands. Split by company or by month when it
  matters.
- **Data repo.** `pointbreaklab-hub/pointbreak-data` does not exist. Job board
  and tracker read fixtures behind an async seam; profile reads live GitHub.

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
