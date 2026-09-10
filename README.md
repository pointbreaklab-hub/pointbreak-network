# PointBreak Network

A job network with no backend. The client is a static bundle, the database is a
Git repository, and the ranking algorithm ships in the same repo you're reading.

**Math over emotion** — read the [manifesto](docs/MANIFESTO.md).

---

## Architecture

```
Browser (static SvelteKit bundle on GitHub Pages)
   ├── reads  ──> GitHub REST API  ──> data repo (JSON in Git)
   ├── writes ──> commits signed by the user's own GitHub identity
   ├── caches ──> IndexedDB (Dexie) — a cache, never a source of truth
   └── scores ──> client-side math engine, no server round-trip
                        │
Cloudflare Worker ──────┘  the ONLY server: verifies Stripe webhooks and
                           signs Ed25519 receipts. Stateless. Stores nothing.
```

Two consequences worth stating plainly:

- **No server to compromise.** There is no application database and no session
  store. The one server holds a signing key and forgets everything else.
- **No platform lock-in.** All network state is JSON in Git. Forking the network
  is `git clone`.

## Layout

| Path | What lives there |
|---|---|
| `src/core/` | Shell, routing, auth, cache, GitHub wrapper, math engine |
| `src/extensions/` | Self-contained features, auto-discovered via `manifest.yaml` |
| `src/lib/` | Shared types, crypto, utilities |
| `src/routes/` | SvelteKit file-based routes (thin hosts for extension components) |
| `worker/` | Cloudflare Worker — Stripe webhook and receipt signer |
| `scripts/net-cli.ts` | `net` CLI: list/enable/disable extensions, deploy |
| `docs/` | Manifesto and JSON schema specs |

## Getting started

```bash
npm install
cp .env.example .env    # fill in PUBLIC_GITHUB_CLIENT_ID
npm run dev
```

Type-check and build:

```bash
npm run check
npm run build
```

## Extensions

A feature is a directory. Drop it under `src/extensions/`, give it a
`manifest.yaml`, and the registry finds it at build time — there is no central
list to update.

```bash
npm run net -- list
npm run net -- disable messaging-inbox
npm run net -- deploy
```

Disabled extensions are tree-shaken out of the bundle entirely. Manifest schema:
[docs/API_SPECS.md](docs/API_SPECS.md#extension-manifest).

## The Ghost Score

Computed in the browser by
[`src/core/math-engine/ghost-score.ts`](src/core/math-engine/ghost-score.ts).
A flat rule table, clamped to 0–100, where higher is worse:

| Δ | Condition |
|---|---|
| +20 | Open > 30 days with 0 interviews and 0 rejections |
| +30 | Identical description reposted more than twice |
| +20 | More than 100 applications with 0 interviews |
| −5 | Per interview scheduled |
| −1 | Per rejection sent |

Bands: 🟢 Active (<30) · 🟡 Evergreen (30–59) · 🔴 Ghost job (≥60).

A company lowers its score by *acting* — scheduling interviews, sending
rejections, closing filled roles. Nothing else moves it, and nothing can be
bought.

## Deployment

Pushing to `main` builds and publishes to GitHub Pages via
[`.github/workflows/deploy-pages.yml`](.github/workflows/deploy-pages.yml).
`adapter-static` is required: GitHub Pages serves flat files.

The Worker deploys separately:

```bash
npm run worker:deploy
```

Worker secrets are set with `wrangler secret put` and never committed:
`STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `RECEIPT_SIGNING_KEY`,
`GITHUB_APP_TOKEN`.

## Status

Phases 1, 2, 5 and most of 6 are in place: static shell, auth, GitHub wrapper,
cache, and the full math engine. Phases 3 and 4 are UI components without their
data wiring. See [docs/ROADMAP.md](docs/ROADMAP.md) for the checklist and the
open questions.

## License

Not yet chosen — see [docs/ROADMAP.md](docs/ROADMAP.md#open-questions).
