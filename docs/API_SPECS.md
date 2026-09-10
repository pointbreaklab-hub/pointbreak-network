# API Specs

All network state is JSON in Git. There is no private API. This document is the
schema contract between clients.

Canonical TypeScript definitions: [`src/lib/types.ts`](../src/lib/types.ts).

---

## Storage layout

The data repository is a normal Git repo:

```
data/
├── jobs/<jobId>.json                  # one file per posting
├── companies/<companyId>.json         # company profile + disclosed funnel stats
├── profiles/<login>.json              # candidate ship logs and skills
├── applications/<jobId>/<login>.json  # application + status transitions
├── receipts/<receiptId>.json          # Ed25519-signed payment/outcome receipts
└── messages/<login>/<threadId>.json   # encrypted async message requests
```

Reads: unauthenticated GitHub contents API, cached in IndexedDB.
Writes: commits authored by the user's own GitHub identity via OAuth Device Flow.

---

## JobPost

```jsonc
{
  "id": "job_01J8X...",              // ULID
  "companyId": "acme-corp",
  "title": "Backend Engineer",
  "location": { "type": "remote", "region": "EU" },  // remote | hybrid | onsite
  "compensation": {                  // required — no post without a range
    "min": 90000,
    "max": 130000,
    "currency": "EUR",
    "period": "year",
    "equity": "0.05-0.15%"
  },
  "description": "…markdown…",
  "postedAt": "2026-09-10T08:00:00Z",
  "closesAt": "2026-10-10T00:00:00Z",
  "status": "open",                  // open | filled | withdrawn | expired
  "disclosure": {                    // what makes the Ghost Score computable
    "applicationsReceived": 148,
    "advancedToScreen": 22,
    "advancedToOnsite": 6,
    "offersExtended": 1,
    "hires": 1,
    "lastUpdated": "2026-09-09T12:00:00Z"
  },
  "receiptId": "rcp_01J8X…"          // proof the posting was paid for
}
```

## ShipLog

An entry in a candidate's record: a thing shipped, not a duty performed.

```jsonc
{
  "id": "log_01J8X…",
  "login": "octocat",
  "title": "Cut p99 checkout latency 840ms -> 120ms",
  "shippedAt": "2026-04-01",
  "skills": ["postgres", "go", "profiling"],
  "evidence": [
    { "type": "repo", "url": "https://github.com/…" },
    { "type": "writeup", "url": "https://…" }
  ],
  "verifiedBy": ["github:someone"]   // optional peer attestation
}
```

## Receipt

Signed by the Worker's Ed25519 key. Verifiable offline.

```jsonc
{
  "id": "rcp_01J8X…",
  "kind": "job_post_payment",        // job_post_payment | outcome_attestation
  "subject": "job_01J8X…",
  "amount": 4900,
  "currency": "eur",
  "issuedAt": "2026-09-10T08:00:00Z",
  "signature": "base64(ed25519)",    // over the canonical JSON of all fields above
  "publicKeyId": "pb-receipts-2026"
}
```

Verification: canonicalize every field except `signature`, then check with
`verifyReceipt()` in [`src/lib/crypto.ts`](../src/lib/crypto.ts).

## GhostScore

Computed client-side by [`src/core/math-engine/`](../src/core/math-engine/).
Never stored — always derived, so it cannot be tampered with in transit.

```jsonc
{
  "jobId": "job_01J8X…",
  "score": 0.72,                     // 0 = healthy, 1 = almost certainly a ghost
  "confidence": 0.58,                // low when disclosure is sparse
  "signals": [
    { "name": "staleness",          "weight": 0.30, "value": 0.9 },
    { "name": "responseRate",       "weight": 0.30, "value": 0.6 },
    { "name": "funnelDropoff",      "weight": 0.20, "value": 0.4 },
    { "name": "repostFrequency",    "weight": 0.20, "value": 0.8 }
  ]
}
```

An undisclosed input does not count as a good score — it lowers `confidence`,
and low-confidence postings rank below disclosed ones.

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

permissions:               # declared up front; the shell enforces them
  - github:read:repo
  - db:jobs:read
  - db:jobs:write

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
