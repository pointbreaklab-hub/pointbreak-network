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
6. **One external server.** A serverless ledger service handles Stripe and
   PayPal micro-payments and returns cryptographically signed receipts.
7. **Candidate-first measurement.** A job does not need a company account to be
   measured. Candidates log postings from anywhere and the network scores them
   from what candidates report.
8. **Nothing self-reported counts.** Every input to a Ghost Score is derived
   from the ledger, and a company claim is worth nothing until the candidate it
   names confirms it.
9. **No candidate identity in public data.** The ledger carries random
   pseudonyms, never GitHub logins.

## 3. End-to-end user journeys

### Candidate

1. **Discovery.** Lands on `pointbreaklab.com`, reads the manifesto, clicks
   "Launch App".
2. **Authentication.** A fine-grained token pasted at `/app/login`. No passwords, no OAuth app. See section 4b.
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
3. **Payment.** The ledger service processes the micro-fee and returns a signed receipt.
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

- **Token sign-in.** The user creates a fine-grained token, scoped read-only,
  and pastes it. Verified against `/user` before being stored. Device Flow is
  not usable from a browser, see section 4b.
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
- **Payment handshake.** ledger service processes the fee and the signed
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

## 4a. Revisions after the first review

Four flaws in the original design, and what replaced them. These override
anything earlier in this document that contradicts them.

### Self-reported metrics

The Ghost Score originally read `metrics` from `job.json`, a file the company
writes. A company wanting a clean score simply wrote clean numbers, so the
honesty meter ran on self-reported honesty.

`Job` no longer has a `metrics` field at all. Metrics are derived from the
ledger by `deriveMetrics()`. Company-authored actions are **claims** that earn
nothing until the affected candidate appends a `claim_confirmed` event.
Candidate-authored events count immediately, because nobody invents a rejection
they did not receive. A company caught claiming actions candidates dispute takes
a penalty, gated behind three disputes and a twenty percent rate so a single
spite dispute cannot move a score.

Critically, an unconfirmed claim does not reset the Black Hole clock. Marking
work as done is not the same as doing it.

### Candidate privacy

The ledger contained `github_login` in a public, append-only, permanent file.
That published everyone's job search to their current employer.

Applications are now referenced by `ApplicationRef`, 128 random bits minted in
the browser. The mapping back to a person exists only in that person's own
IndexedDB. A hash of the login would not do: logins are enumerable, so anyone
could test whether a specific person applied somewhere.

The tradeoff is sybil resistance. Distinct refs are assumed to be distinct
people, so Squad counts are a floor rather than a proof. This is the right way
round: overcounting silence is a smaller harm than exposing job seekers.

### Company participation

The original model needed companies to opt into being measured, which no
recruiting team does. The pitch was "pay us to publish data that can damage
you", so the only non-participants were the companies most worth measuring.

Jobs now carry `source: 'pointbreak' | 'external'`. External jobs are logged by
candidates from LinkedIn, Greenhouse, or any careers page, and are scored
without the company's involvement. Postings dedupe on a normalized URL hash so
the same job logged by many people aggregates into one record, and company
identity resolves from the domain so `acme.com` and `careers.acme.com` are one
company.

A company's only levers are to behave better or to dispute the record with
evidence, which is also the acquisition channel.

### Skill evidence

Ranking on public commit volume buries the people this product exists for. Most
professional engineering happens in private repositories, so a senior engineer
at a bank has an empty public profile while someone with forty tutorial
repositories looks prolific.

A skill now carries typed evidence: `public_commits`, `merged_prs`,
`private_contributions`, `peer_attestation`, `external_artifact`. The UI shows
which evidence backs each claim rather than collapsing them into one number.
Private contribution totals come from GitHub's `restrictedContributionsCount`,
which proves volume without naming a single repository.

### Ledger writes, and why the ledger service makes them

Both gaps left open by the previous revision came down to one fact: **a Git
commit carries its author.**

If a candidate committed their own application, `git log` on the public data
repo would map every pseudonymous `application_ref` back to a real person, and
an employer could read an employee's entire job search. Setting the `author`
field does not help, because GitHub records the authenticated pusher regardless.
Fork-and-PR leaks the same way through the PR author.

So pseudonymous append to a shared public ledger cannot be done with the
candidate's own credentials. The ledger service commits on everyone's behalf, and only
the random ref reaches the file.

This makes the ledger service a trusted component, which it was not before. The design
narrows that trust rather than hiding it:

- **Issuance and append are separate requests.** `POST /ledger/token`
  authenticates the account and names only the job. `POST /ledger/append`
  authenticates with the token and names only the ref. No single request
  contains both a login and a ref.
- **The guard store holds no plaintext.** Sybil keys are HMACs of
  account and job, so a dump of the namespace identifies nobody.
- **Timestamps are server-stamped**, since a client-supplied time could backdate
  silence.
- **Candidates cannot append company claims.** The append route rejects any
  company action outright, so nobody can credit a company on its behalf, or
  frame one.

The residual assumption is that the ledger service does not log across requests to
correlate issuance with append. It does not, and the source is in this
repository, but that is an operational promise rather than a cryptographic
guarantee. The real fix is a blind signature scheme, where the ledger service signs a
token it provably cannot recognise later. That is the intended replacement.

### 4b. Why auth is a pasted token, not Device Flow

Rule 6 originally said GitHub OAuth Device Flow. It solves the client-secret
problem, which is the reason it was chosen, and it cannot be completed from a
static page.

`github.com/login/device/code` and `github.com/login/oauth/access_token` send no
`Access-Control-Allow-Origin` header, so the browser refuses the request before
it leaves. The only symptom is a bare "Failed to fetch", because that is all
CORS reports. Check it directly:

```
curl -si -X POST https://github.com/login/device/code \
  -H 'Origin: https://example.com' | grep -i access-control
```

Nothing comes back. `api.github.com` does send the header, which is why every
other call in the app works.

Completing Device Flow therefore needs a server to relay two requests. Rather
than add one for sign-in, the user creates a fine-grained token, scopes it, and
pastes it. That is arguably the better fit anyway: the credential is theirs,
scoped by them, revocable by them, and no third party issues or holds anything.

Read-only public access plus profile is enough. Nothing in the app asks for
write scope.

### Sybil resistance

Squad counts are the most visible number in the product, so manufacturing them
has to cost something.

- **One token per account per posting.** A single person cannot mint twenty refs
  against one job.
- **Minimum account age**, default 30 days. Throwaway accounts are the cheapest
  way to fake consensus.
- **Monthly append budget**, default 60, which bounds the damage if someone
  farms aged accounts.
- **Single-use tokens**, so one issuance cannot become an unbounded stream.

A determined attacker with many aged GitHub accounts can still inflate a count.
The claim is that it is no longer free, not that it is impossible.

### Peer attestation

The path that works when your work was never public. A colleague who reviewed it
says so, under their own name.

Unlike applications, attestations are **not** pseudonymous. An anonymous vouch
is worth nothing, so the voucher's real login is recorded.

The obvious attack is a ring: ten fresh accounts vouch for each other and all
ten look credible. The defence is that a vouch has no intrinsic weight. It
inherits the voucher's, computed only from what GitHub attests about them, so a
ring multiplies zero.

Credibility counts public commits, merged pull requests at twenty times the
weight of a commit, and the aggregate private contribution total, on a square
root curve so one prolific account cannot dominate every vouch it makes.
Private contributions are included deliberately: an engineer behind a corporate
firewall is often the most valuable voucher about another such engineer, and
excluding them would rebuild the bias this model exists to remove.

Worked example, verifiable by running the scenario:

| Voucher | Public | PRs | Private | Weight |
|---|---|---|---|---|
| `marcus-bell`, her tech lead, bank, little public | 40 | 2 | 6,200 | **0.886** |
| `sofia-almeida`, former colleague, works in the open | 2,040 | 90 | 900 | 0.770 |
| `dev-okonkwo`, junior who worked with her briefly | 200 | 3 | 0 | 0.180 |
| `ring-alpha`, `ring-beta`, `ring-gamma`, created last month | 0 | 0 | 0 | **0.000** |

Priya has fourteen years at a bank and three public commits. Before
attestation her profile reads `Java: 3 public commits` and nothing else. After,
it reads `Java: 3 public commits + 0.77 vouched` and `Kotlin: 1.07 vouched`, a
skill with no public evidence at all, plus the 4,812 private contributions
GitHub confirms without naming a repository.

The ring's attempt to manufacture a Rust skill never appears. Its vouches stay
in the ledger, shown as zero rather than deleted, because deleting them would
hide the attempt.

Abuse controls: you cannot vouch for yourself, one vouch per person per skill,
and the same account age bar applies.

## 5. Data flow and state management

- **Source of truth.** GitHub repositories holding JSON/JSONL.
- **Transport.** GitHub REST API, called directly from the browser.
- **Local cache.** IndexedDB.
- **UI state.** Svelte stores, updated when the cache or the API returns data.

Entities:

- **User Profile.** GitHub login, verified skills array, ship logs.
- **Job Post.** Title, source, salary and whether it was disclosed at all, tech
  stack, description hash, receipt, current status. No metrics: those are
  derived.
- **Event Ledger.** Append-only log of actions. Written only by the ledger service, and
  carrying pseudonymous refs rather than logins.
- **Peer Attestation.** A vouch from one engineer to another on a named skill,
  carrying the voucher's real identity.
- **Application Record.** Derived from the ledger, never stored. Keyed by a
  pseudonymous application ref, not by a person.

## 6. Security, privacy and moderation

- **Zero-trust reporting.** A user report never lowers a score by itself. It
  triggers an audit of the Event Ledger, and if the data shows the company was
  interviewing and rejecting, the report is dismissed.
- **Pseudonymous applications.** Public data contains no GitHub login. See
  section 4a.
- **Attested actions only.** A company cannot credit itself. See section 4a.
- **Client-side encryption.** Message contents are encrypted in the browser
  before being pushed. GitHub stores ciphertext only.
- **No secrets in the frontend.** Payment keys and OAuth client secrets never
  appear in the Svelte codebase. Payments route through the ledger service, and Device
  Flow needs no client secret.
- **Rate limiting.** Relies on GitHub's native limits plus local ETag caching.

## 7. Deployment and CI/CD

- **Automated builds.** GitHub Actions on every push to `main`: type-check,
  build static assets, deploy with the `actions/deploy-pages` artifact method.
- **DNS.** Apex uses four A records pointing at GitHub Pages. `www` is a CNAME
  to the Pages URL. `app.pointbreaklab.com` is a the ledger service 301 redirect to
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
- **No domain-gated alumni reviews.** Verifying *ex*-employees in order to
  collect reviews about a company stays out of scope. Company accountability
  rests on the math engine. Note this is narrower than it was: verifying your
  own current employment is in scope as section 9.1, because it evidences a
  person rather than gathering opinions about a company.
- **No traditional backend.** No Express, Django, or Rails. No SQL.

---

# 9. Identity, portfolio and visibility

Drafted, not built. The decisions marked **OPEN** change the data model, so they
are cheaper to settle here than after there are real CVs in a public repository.

## 9.1 Employment verification

Send a code to an address at the employer's domain. Enter the code, get a badge.

### What it proves, exactly

That at a moment in time, someone controlled an address at that domain.

It does **not** prove role, seniority, tenure, or that the person still works
there. The badge must therefore read `verified @amazon.com, Sep 2026`, never
"works at Amazon". A product whose whole argument is that claims should not be
overstated cannot start overstating its own.

### Expiry is the feature, not the problem

People leave. A badge earned in 2026 means nothing in 2028, so verification is
re-checked periodically and a lapse is not a failure.

A lapsed badge becomes `verified @amazon.com, Jan 2024 to Sep 2026`, which is an
employment record with dates. That is precisely what a CV asserts and normally
cannot evidence, so the decayed state is more valuable than the fresh one.

### The free-provider blocklist is the wrong shape

Blocking gmail, hotmail and the rest is an endless list and wrong by default.
The check should be an allowlist per company instead: does this domain appear in
that company's record.

```jsonc
// companies/amazon.json
{
  "id": "amazon",
  "name": "Amazon",
  "domains": ["amazon.com", "amazon.de", "amazon.in", "amazon.co.uk"]
}
```

Domains live in Git, so adding one is a pull request: publicly proposed,
publicly reviewed, publicly logged. Pattern matching on `amazon.*` would accept
`amazon.evil-tld`, and a global blocklist would still accept `amaz0n.com`.

The badge shows the raw verified domain regardless, so a reader can judge a
lookalike themselves rather than trusting our matching.

Small companies on `@gmail.com` cannot get a badge. That is a real cost and the
right trade: the badge means nothing if a free address earns it.

Contractors verify their agency's domain, which is honest. The badge says where
the mail came from, and nothing more.

### The address is never published

Store the domain, the verification date, and a salted hash. Never the local
part, never the raw address.

A public repository of work email addresses would be a spam and phishing
resource, and it would be the single most harmful thing this project could
publish. The hash exists only to detect one address verifying many accounts.

### Abuse controls

- Short-lived, single-use codes, compared in constant time.
- Rate limited per address and per domain, so the flow cannot enumerate who
  works somewhere.
- Role accounts refused: `careers@`, `info@`, `hr@`, `admin@` and similar are
  shared mailboxes, so control of one proves nothing about a person.
- One pending verification per account at a time.

### What it unlocks

- **A non-social evidence path.** The engineer with no public repositories and
  no colleague willing to vouch can still evidence fourteen years somewhere.
  This is the answer to "what if nobody vouches".
- **Company claiming**, which the company dashboard currently lacks entirely.
  Whoever verifies at a company's domain can claim its profile, which is what
  makes company-side accountability real rather than demonstration data.
- **A usable "hiring manager" audience** for 9.3, with the caveat that a
  verified domain proves employment, not authority to hire.

### Education, same mechanism, different meaning

Studying somewhere verifies the same way: a code to an address at the
institution's domain. Four things differ, and they matter.

**It does not expire, because the claim is past tense.** "Works at" is a present
tense claim and needs re-checking. "Studied at" is permanent, so it is verified
once and stands. This also avoids a trap: some universities revoke access on
graduation, so requiring re-verification would punish exactly the graduates the
badge is for.

**It is weaker evidence than employment, and should be presented as such.** A
student address usually outlives the relationship, so there is no liveness
check, and .edu addresses are openly traded for student discounts. Employment
verification re-proves itself; education verification cannot. A reader should
not read the two badges as equally strong.

**There is no global TLD pattern.** `.edu` is United States only. Elsewhere:
`.ac.uk`, `.ac.in`, `.edu.au`, and then Germany and Canada break any rule at all
with `tu-berlin.de`, `utoronto.ca`, `mcgill.ca`, `tudelft.nl`. Matching on a TLD
would verify Americans and reject everyone else. The per-institution domain
allowlist already required for companies handles this, and is the only thing
that can.

**It proves affiliation, not a degree.** Someone who left after one semester has
the same address as a doctoral graduate, and so does the maintenance staff. The
badge says `verified @mit.edu`, and the degree, field, class and graduation year
stay unverified claims on the CV.

One domain registry serves both, since a university is also an employer. The
record carries the domains; the user states whether they studied or worked
there; the badge shows the claim and the verified domain side by side. Someone
could verify as staff and claim to have studied, and short of registrar
integration nothing prevents that. Showing both is the honest answer.

### Education must not count toward skill

The manifesto says candidates prove skills through shipped work. A degree is a
credential, and weighting it as skill evidence would walk this product back
toward the thing it exists to argue against.

So an education badge corroborates the education lines on a CV and contributes
nothing to skill evidence or ranking. It is biography, not proof of ability.
Employment verification is treated the same way: it corroborates employment
dates, and the work itself is still evidenced by commits, merged pull requests,
private contribution volume and vouches.

### OPEN: sending the mail

This needs a mail service, and it is a harder dependency than it looks.
Deliverability, not code, is the difficulty: corporate mail servers filter
unknown senders aggressively, and a verification code that lands in spam is a
feature that does not work.

Self-hosted SMTP is possible and delivers poorly without reputation. A
transactional provider delivers well and is another third party. Decide which
before building, given the project's position on outside dependencies.

## 9.2 CV upload and portfolio

A CV is parsed into one canonical structure, and themes render it.

### Claimed against corroborated

A CV is self-reported, and this product's entire argument is that self-reporting
is not trusted. So a portfolio must visibly separate what is claimed from what
is evidenced: a merged pull request, a vouch, a verified domain.

This is the strongest part of the idea rather than a compromise. A resume where
some lines carry evidence and the rest are marked as claims does not currently
exist anywhere, and it makes the vouch request concrete: a colleague confirms
one specific line rather than writing prose.

### Themes

One canonical JSON, several renderers, so a theme can never change the content.

- **Series.** Companies as shows, roles as episodes, promotions as new seasons.
  Do not name it after a streaming service in code, copy, or palette. Trademark
  trouble is a foolish way to lose a project.
- **Plain.** White, typographic, printable, the default.
- **Tinted.** Plain with a user-chosen accent, validated for contrast so a
  choice cannot render the page unreadable.

A motion-heavy theme needs a `prefers-reduced-motion` fallback, and every theme
needs to print.

### OPEN: where a CV lives

A CV holds a phone number, a home address, a personal email. The database is a
public Git repository. There is no private storage anywhere in this
architecture, and this is the blocker.

1. Publish only the parsed, redacted structure and never the file. Simple, and
   contact details cannot round-trip.
2. Keep private profiles in the user's own private repository. They own it,
   and discovery becomes harder.
3. Encrypt per recipient. Strongest, and key management is real work.

Whichever is chosen, personal contact details are stripped before anything is
published, and the user sees exactly what will become public before it does.

### OPEN: parsing

PDF and DOCX to structured data is unreliable, and doing it client-side keeps
the file off any server. An imperfect parse the user corrects is acceptable;
silently mangling employment dates is not. Parse, then show the result for
correction before anything is saved.

## 9.3 Visibility

Proposed: public, specific people, hiring managers, hidden.

### OPEN: this is access control, and a static site over public data has none

Three of those four states cannot be enforced by the current architecture. If
the data is in a public repository, it is public, whatever the toggle says.

The one thing that must not ship is a control that implies restriction and does
not restrict, because people will put real data behind it.

1. **Public or nothing.** Honest, enforceable today, and much less useful.
2. **Private repo for restricted profiles.** GitHub enforces it. Sharing means
   granting repository access, which is clumsy.
3. **Encrypt, share keys with named recipients.** Real enforcement without a
   server. Revocation means re-encrypting.
4. **Gate reads behind the ledger service.** Familiar, and it makes the service
   load-bearing for reading, which it currently is not.

"Hiring managers" additionally needs that audience to be verifiable. 9.1 gets as
far as proving employment, which is not the same as authority to hire.

## 9.4 Discoverability

Portfolios are the one part of this site with a real case for being indexed by
search engines, and architectural rule 3 disables SSR, so they would ship as
empty shells.

Prerendering public portfolios at build time needs no server and keeps the rule
intact. It does mean a build per published profile, which does not scale to many
users on GitHub Pages. Worth solving when there are enough profiles for it to
matter.
