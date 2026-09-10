# API Specs

All network state is JSON in Git. There is no private API. This document is the
schema contract between clients.

Canonical TypeScript definitions: [`src/lib/types.ts`](../src/lib/types.ts).
Field names are `snake_case` — these are on-disk wire formats, read straight out
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
  "salary": {
    "min": 90000,
    "max": 105000,
    "currency": "EUR",
    "period": "year"
  },
  "tech_stack": ["go", "postgres", "kubernetes"],
  "description": "…markdown…",
  "posted_at": "2026-09-10T08:00:00Z",
  "status": "open",                    // open | closed
  "closed_at": null,
  "close_reason": null,                // external_hire | internal_hire | cancelled
  "metrics": {
    "applications": 148,
    "views": 1902,
    "interviews_scheduled": 6,
    "rejections_sent": 40,
    "reposts": 1
  },
  "receipt_id": "rcp_01J8X…"
}
```

**Exact salary is mandatory.** A band wider than 25% of its own midpoint is
rejected at submit — see `isExactSalary()` in
[`src/lib/utils.ts`](../src/lib/utils.ts). `metrics` is the sole input to the
Ghost Score, which is why it is part of the posting rather than private.

## `application` event

Appended to `events/<job_id>.jsonl`, one JSON object per line.

```jsonc
{
  "job_id": "job_01J8X…",
  "github_login": "dev_user",
  "status": "submitted",               // submitted | viewed | interviewing | rejected
  "submitted_at": "2026-08-01T09:00:00Z",
  "last_action_at": "2026-08-03T11:20:00Z"
}
```

`last_action_at` is the last time the *company* did anything. The gap between it
and now is the entire Black Hole signal, so it must never be touched by a
candidate-side write.

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

### Ghost Score — `src/core/math-engine/ghost-score.ts`

```jsonc
{
  "job_id": "job_01J8X…",
  "score": 45,                         // 0–100, higher is worse
  "band": "evergreen",                 // active | evergreen | ghost
  "breakdown": [
    { "id": "stale_no_engagement", "label": "…", "points": 20, "applied": true },
    { "id": "interviews_held",     "label": "…", "points": -30, "applied": true }
  ]
}
```

| Δ | Rule id | Condition |
|---|---|---|
| +20 | `stale_no_engagement` | Open > 30 days, 0 interviews, 0 rejections |
| +30 | `serial_repost` | Identical description reposted more than twice |
| +20 | `volume_no_interviews` | More than 100 applications, 0 interviews |
| −5 | `interviews_held` | Per interview scheduled |
| −1 | `rejections_sent` | Per rejection sent |

Bands: 🟢 Active `<30` · 🟡 Evergreen `30–59` · 🔴 Ghost `≥60`.

### Black Hole — `src/core/math-engine/black-hole.ts`

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

### Repost detection — `src/core/math-engine/similarity.ts`

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
