# API Specs

All network state is JSON in Git. There is no private API. This document is the
schema contract between clients.

Canonical TypeScript definitions: [`src/lib/types.ts`](../src/lib/types.ts).
Field names are `snake_case`. These are on-disk wire formats, read straight out
of JSON files.

---

## Storage layout

The data repository is a normal Git repo:

```
data/
├── users/<github_login>.json          # profile: verified skills + ship logs
├── jobs/<job_id>.json                 # one file per posting
├── companies/<company_id>.json        # company profile
├── events/<job_id>.jsonl              # append-only application state changes
├── receipts/<receipt_id>.json         # Ed25519-signed payment receipts
└── inbox/<github_login>/<thread_id>.json  # encrypted message requests
```

Reads: GitHub contents API, cached in IndexedDB, ETag-validated.
Writes: commits authored by the user's own GitHub identity via OAuth Device Flow.

---

## `user.json`

```jsonc
{
  "github_login": "dev_user",
  "display_name": "Dev User",
  "verified_skills": [
    { "skill": "TypeScript", "commits": 450 }
  ],
  "ship_logs": [
    {
      "repo": "pointbreak-network/pointbreak-network",
      "pr": 12,
      "merged_at": "2026-01-01",
      "title": "Add ghost score meter",
      "url": "https://github.com/…/pull/12"
    }
  ],
  "updated_at": "2026-09-10T08:00:00Z"
}
```

Skills are derived from commit volume in public repos. There is no
self-assessment field, and there is no endorsement field.

## `job.json`

```jsonc
{
  "id": "job_01J8X…",
  "company_id": "acme-corp",
  "title": "Backend Engineer",
  "source": "external",               // pointbreak | external
  "source_url": "https://linkedin.com/jobs/view/4023998812",
  "source_hash": "sha256:c4f1a09b…",  // normalized URL, used to dedupe
  "salary": { "min": 90000, "max": 105000, "currency": "EUR", "period": "year" },
  "salary_disclosed": true,
  "tech_stack": ["go", "postgres"],
  "description": "…markdown…",
  "description_hash": "sha256:9f2c…",
  "posted_at": "2026-09-10T08:00:00Z",
  "first_seen_at": "2026-09-10T08:00:00Z",
  "status": "open",
  "close_reason": null,               // external_hire | internal_hire | cancelled
  "receipt_id": "rcp_01J8X…"
}
```

**There is no `metrics` field, deliberately.** Every number feeding a Ghost
Score is derived from the ledger by `deriveMetrics()`. A company writing its own
metrics into its own file was the largest hole in the original design.

`source: "external"` means a candidate logged this from elsewhere and the
company has no account. Those postings are scored anyway. `source_hash` is a
hash of the normalized URL so the same job logged by many candidates collapses
into one record.

`salary_disclosed` is separate from `salary` because absence of disclosure is
itself information. Exact salary is mandatory for `source: "pointbreak"` and
merely recorded for external postings.

## Event Ledger

Appended to `events/<job_id>.jsonl`, one JSON object per line. Append only:
lines are never edited or deleted.

```jsonc
{
  "id": "ev_0007",
  "job_id": "job_01J8X…",
  "application_ref": "app_9f2c4b17e3a85d0c6f1b2e7a4d8c3059",
  "action": "resume_viewed",
  "at": "2026-08-03T11:20:00Z",
  "actor": "company",
  "ref_event": null                   // set on claim_confirmed / claim_disputed
}
```

### Actions

| Action | Actor | Counts |
|---|---|---|
| `application_submitted` | candidate | immediately |
| `rejection_received` | candidate | immediately |
| `interview_held` | candidate | immediately |
| `offer_received` | candidate | immediately |
| `withdrawn` | candidate | immediately |
| `resume_viewed` | company | only once confirmed |
| `rejection_sent` | company | only once confirmed |
| `interview_scheduled` | company | only once confirmed |
| `claim_confirmed` | candidate | attests a claim, via `ref_event` |
| `claim_disputed` | candidate | rejects a claim, via `ref_event` |

Candidate-authored events count on sight: nobody invents a rejection they did
not receive. Company claims are worth nothing until the candidate they name
confirms them, and an unconfirmed claim **does not reset the Black Hole clock**.
A dispute always beats a confirmation on the same event.

### `application_ref`

128 random bits minted in the browser, never derived from a GitHub login. The
public ledger therefore contains no candidate identity, and the mapping back to
a person lives only in that person's IndexedDB.

A hash of the login would not be enough: logins are enumerable, so anyone could
compute the hash for one person and test whether they applied somewhere.

The cost is sybil resistance. Distinct refs are assumed to be distinct people,
which makes Squad counts a floor rather than a proof.

## Application Record

Derived from the ledger by `projectAll()` in
[`src/core/math-engine/ledger.ts`](../src/core/math-engine/ledger.ts), never
stored.

```jsonc
{
  "job_id": "job_01J8X…",
  "application_ref": "app_9f2c4b17e3a85d0c6f1b2e7a4d8c3059",
  "status": "viewed",   // submitted | viewed | interviewing | rejected | offer | withdrawn
  "submitted_at": "2026-08-01T09:00:00Z",
  "last_action_at": "2026-08-03T11:20:00Z",
  "pending_claims": []  // company claims awaiting this candidate's attestation
}
```

`status` is the highest stage reached, so a view logged after an interview is
not a demotion. `last_action_at` is the timestamp of the most recent *company*
action, and the gap between it and now is the entire Black Hole signal.
Projecting rather than storing means a company cannot change what a candidate
sees without appending an event that also moves its own Ghost Score.

## Peer attestations

Appended to `attestations/<subject_login>.jsonl`, one per line, append only.

```jsonc
{
  "id": "att_9f2c4b17e3a85d0c",
  "subject": "priya-raghavan",     // lowercased GitHub login
  "skill": "Kotlin",
  "note": "Rewrote our settlement engine, ~40k lines. I reviewed most of it.",
  "attested_by": "marcus-bell",    // real login, deliberately not pseudonymous
  "at": "2026-09-12T10:00:00Z"
}
```

These are the one place identity is the point. An anonymous vouch is worth
nothing, so the voucher's login is recorded and their credibility is what gives
the vouch weight.

A vouch carries no intrinsic weight. It inherits the voucher's, computed by
`voucherCredibility()` from public commits, merged pull requests at twenty times
a commit, and the aggregate private contribution total, on a square root curve
saturating at 8,000. Nothing the voucher says about themselves counts, which is
what makes a ring of fresh accounts worth zero.

Vouches below weight `0.05` are kept in the ledger and rendered as zero rather
than removed, because deleting them would hide the attempt.

Constraints, enforced by the Worker: no self-vouching, one vouch per voucher per
subject per skill, and the same minimum account age as ledger appends.

Run `npm run scenario:attestation` for a worked example.

## `receipt.json`

Signed by the Worker's Ed25519 key. Verifiable offline, so the client never has
to take the Worker's word for it.

```jsonc
{
  "id": "rcp_01J8X…",
  "kind": "job_post_payment",
  "subject": "job_01J8X…",
  "amount": 4900,
  "currency": "eur",
  "issued_at": "2026-09-10T08:00:00Z",
  "signature": "base64(ed25519)",
  "public_key_id": "pb-receipts-2026"
}
```

Verification: canonicalize every field except `signature`, then check with
`verifyReceipt()` in [`src/lib/crypto.ts`](../src/lib/crypto.ts).

---

## Derived values

Never stored. Always recomputed client-side, so a tampered file changes the
inputs but cannot forge the output.

### Ghost Score: `src/core/math-engine/ghost-score.ts`

```jsonc
{
  "job_id": "job_01J8X…",
  "score": 85,                         // 0-100, higher is worse
  "band": "ghost",                     // active | evergreen | ghost
  "sample": 24,                        // tracked applications behind the score
  "breakdown": [
    { "id": "stale_no_engagement", "label": "…", "points": 20, "applied": true }
  ]
}
```

| Delta | Rule id | Condition |
|---|---|---|
| +20 | `stale_no_engagement` | Open > 30 days, nothing confirmed by any candidate |
| +30 | `serial_repost` | Same `description_hash` on more than 2 other postings |
| +20 | `total_silence` | 5 or more applicants, none reporting any response |
| +20 | `volume_no_interviews` | More than 100 applications, no confirmed interviews |
| +15 | `inflated_claims` | 3 or more disputes, and over 20% of claims disputed |
| -5 | `interviews_held` | Per interview a candidate confirmed |
| -1 | `rejections_sent` | Per rejection a candidate confirmed |

Bands: Active `<30`, Evergreen `30-59`, Ghost `>=60`.

`total_silence` exists because externally sourced jobs are only visible through
the candidates who logged them here, so absolute volume thresholds rarely fire.
Twenty people all ignored is damning even though twenty is not many.

`sample` is surfaced in the UI rather than hidden, so a score built on three
reports is not presented as if it were built on three hundred.

`inflated_claims` needs both thresholds. One angry candidate disputing one
rejection must not be able to move a company's score.

### Black Hole: `src/core/math-engine/black-hole.ts`

```jsonc
{
  "job_id": "job_01J8X…",
  "github_login": "dev_user",
  "state": "black_hole",               // submitted | viewed | interviewing | rejected | black_hole
  "days_silent": 31,
  "is_black_hole": true,
  "squad_size": 88                     // others stuck on the same posting
}
```

Triggered when `last_action_at` is more than 14 days old and status is
`submitted` or `viewed`.

### Repost detection: `src/core/math-engine/similarity.ts`

Jaccard index over stopword-filtered tokens, against the company's 50 most
recent postings. Default threshold `0.85`. Jaccard rather than cosine because it
ignores term frequency, so padding a template with filler does not disguise a
repost.

---

## Extension manifest

Every directory under `src/extensions/` is auto-discovered at build time by
[`src/core/registry.ts`](../src/core/registry.ts) via its `manifest.yaml`.

```yaml
id: job-board              # unique, matches the directory name
name: Job Board
version: 0.1.0
enabled: true              # toggled by `npm run net -- enable|disable <id>`
description: Browse postings with transparency badges and ghost scoring.

routes:
  - path: /app/jobs
    component: components/JobFeed.svelte
    nav:
      label: Jobs
      icon: briefcase
      order: 20

permissions:
  - github:read:repo
  - db:jobs:read

requires:
  core: '>=0.1.0'
```

| Field | Required | Notes |
|---|---|---|
| `id` | yes | Must equal the directory name. |
| `version` | yes | Semver. |
| `enabled` | yes | Disabled extensions are tree-shaken out of the bundle. |
| `routes[].path` | yes | Must be unique across all enabled extensions. |
| `routes[].component` | yes | Path relative to the extension directory. |
| `routes[].nav` | no | Omit to register a route with no nav entry. |
| `permissions` | yes | May be empty, but the key must be present. |
