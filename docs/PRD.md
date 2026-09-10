# Pointbreak Network: Web MVP Master Plan

The product requirements document and architectural blueprint. Where this
document and the code disagree, this document wins and the code is the bug.

Implementation status lives in [ROADMAP.md](ROADMAP.md). Schemas live in
[API_SPECS.md](API_SPECS.md).

## 1. Core philosophy and product vision

- **The manifesto.** "We don't do emotions. We do math." The platform exposes
  the truth of the hiring market through objective data, not subjective reviews.
- **Two-way accountability.** Candidates prove skills via verifiable Git
  history. Companies prove hiring intent via transparent action metrics.
- **Equal access.** No premium tiers, no pay-to-message, no VIP visibility
  boosts. Every user interacts with the same algorithmic rules.
- **Target audience.** Software engineers, technical founders, engineering
  managers. Non-technical roles are out of scope for the MVP.

## 2. Architectural decisions

1. **Single origin.** Landing page and app both live on the apex domain
   `pointbreaklab.com`, with the app under `/app/*`. This avoids cross-origin
   problems with local storage, service workers, and session tokens.
2. **Git as a database.** No traditional backend. GitHub repositories are the
   database, read and written as JSON/JSONL through the GitHub REST API.
3. **Static hosting.** SvelteKit compiled with the static adapter, hosted on
   GitHub Pages. SSR globally disabled.
4. **Client-side math engine.** Ghost Score, Black Hole detection, and repost
   similarity all execute in the browser.
5. **ODS-style modularity.** `core` holds routing, auth, and state.
   `extensions` hold features, auto-discovered via manifest files so they can be
   toggled without breaking the core app.
6. **One external server.** A serverless Cloudflare Worker handles Stripe and
   PayPal micro-payments and returns cryptographically signed receipts.

## 3. End-to-end user journeys

### Candidate

1. **Discovery.** Lands on `pointbreaklab.com`, reads the manifesto, clicks
   "Launch App".
2. **Authentication.** GitHub Device Flow at `/app/login`. No passwords.
3. **Profile generation.** The app fetches public GitHub data and generates a
   Ship Log profile, with verified skills from commit volume and merged PRs
   rather than self-reported claims.
4. **Job discovery.** Browses the feed. Every card shows a mandatory exact
   salary, tech stack, and a dynamically calculated Transparency Badge.
5. **Application and tracking.** Applies, then tracks state in the Black Hole
   Tracker: Submitted, Viewed, Interviewing, Rejected, or Black Hole.
6. **Messaging.** Receives an async encrypted message request and accepts it,
   opening a thread stored as encrypted JSON in their GitHub inbox repo.

### Company

1. **Onboarding.** An engineering lead or CTO signs in via GitHub and claims a
   company profile.
2. **Job creation.** At `/app/post-job`, fills in role, exact salary, and tech
   stack. The client-side engine compares the description against their past
   postings and warns if it will be flagged as an Evergreen Repost.
3. **Payment.** The Worker processes the micro-fee and returns a signed receipt.
   The app commits the job data and the receipt to the repo.
4. **Reputation management.** The dashboard shows a live Ghost Score with
   Action Nudges prompting bulk rejections or scheduled interviews.
5. **Closure.** A filled role must be marked External Hire, Internal Hire, or
   Cancelled, which feeds the compliance-loophole algorithm.

## 4. Feature specifications

### Phase 1: foundation and public facing

- **Landing page.** Static page explaining the Ghost Job algorithm, the Black
  Hole tracker, and the Git-backed profile system.
- **App shell and theming.** Base layout, navigation, dark/light toggle. Theme
  persists in local storage to prevent a flash of unstyled content on load.
- **SPA routing fallback.** Deep links such as `/app/jobs` must reach the Svelte
  app rather than a GitHub Pages 404.

### Phase 2: identity and core infrastructure

- **GitHub Device Flow auth.** Generates a device code, prompts authorization on
  GitHub, polls for the access token.
- **GitHub API wrapper.** Fetches and commits JSON, with ETag caching to respect
  rate limits.
- **Local caching layer.** IndexedDB caches profiles, jobs, and events for
  instant loads and partial offline use.

### Phase 3: candidate experience

- **Ship Logs profile.** Replaces the resume. Timeline of merged PRs,
  repositories contributed to, and a verified skills matrix from commit history.
- **Job board and feed.** Searchable. Enforces mandatory exact salary, rejecting
  wide bands. Renders Transparency Badges from the client-side engine.
- **Black Hole Tracker.** Tracks application state. An application viewed but
  not acted on for 14 days turns red. Shows the Black Hole Squad count, meaning
  how many other candidates are stuck on the same posting.
- **Async encrypted inbox.** Polls for message requests. Messages are encrypted
  locally before being committed to the recipient's inbox repo. No WebSockets.

### Phase 4: company experience

- **Job creation form.** Enforces exact salary and specific tech stack. Runs the
  Jaccard/Cosine similarity check to detect copy-pasted Evergreen descriptions.
- **Payment handshake.** Cloudflare Worker processes the fee and the signed
  receipt is stored in the job's JSON file.
- **Company dashboard.** Live Ghost Score meter, applicant management, and
  Action Nudges.

### Phase 5: the math engine

- **Ghost Score.** 0 to 100 from inaction penalties (+20 for 30 days of
  silence), repost penalties (+30 for identical descriptions), and action
  credits (-5 per interview, -1 per rejection).
- **Black Hole detection.** Days since last action on an application, triggering
  at 14 days.
- **Similarity detector.** Jaccard similarity, which ignores term frequency to
  prevent filler-word manipulation, against the company's last 50 postings.

## 5. Data flow and state management

- **Source of truth.** GitHub repositories holding JSON/JSONL.
- **Transport.** GitHub REST API, called directly from the browser.
- **Local cache.** IndexedDB.
- **UI state.** Svelte stores, updated when the cache or the API returns data.

Entities:

- **User Profile.** GitHub login, verified skills array, ship logs.
- **Job Post.** Title, exact salary, tech stack, description hash, payment
  receipt signature, current status.
- **Event Ledger.** Append-only log of actions: application submitted, resume
  viewed, interview scheduled, rejection sent.
- **Application Record.** The relationship and current state between one
  candidate and one job post.

## 6. Security, privacy and moderation

- **Zero-trust reporting.** A user report never lowers a score by itself. It
  triggers an audit of the Event Ledger, and if the data shows the company was
  interviewing and rejecting, the report is dismissed.
- **Client-side encryption.** Message contents are encrypted in the browser
  before being pushed. GitHub stores ciphertext only.
- **No secrets in the frontend.** Payment keys and OAuth client secrets never
  appear in the Svelte codebase. Payments route through the Worker, and Device
  Flow needs no client secret.
- **Rate limiting.** Relies on GitHub's native limits plus local ETag caching.

## 7. Deployment and CI/CD

- **Automated builds.** GitHub Actions on every push to `main`: type-check,
  build static assets, deploy with the `actions/deploy-pages` artifact method.
- **DNS.** Apex uses four A records pointing at GitHub Pages. `www` is a CNAME
  to the Pages URL. `app.pointbreaklab.com` is a Cloudflare 301 redirect to
  `pointbreaklab.com/app/`.
- **Service worker.** Precaches the app shell and hashed assets cache-first,
  network-first for dynamic calls.

## 8. Out of scope for the Web MVP

- **No real-time chat.** No WebSockets or server-sent events. Messaging is async
  and polled.
- **No Tor integration.** Tor P2P chat needs OS-level socket access that
  browsers block. Reserved for the future Tauri desktop app.
- **No mobile app.** The web app is responsive, but no Capacitor or React Native
  builds.
- **No domain-gated alumni reviews.** Verifying ex-employees by corporate email
  domain is too complex for MVP. Company accountability rests on the math engine.
- **No traditional backend.** No Express, Django, or Rails. No SQL.
