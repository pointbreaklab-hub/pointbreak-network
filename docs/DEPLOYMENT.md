# Deployment

One GitHub Pages site, served from the apex domain `pointbreaklab.com`.
The landing page is `/`, the app is `/app/*`, both on the same origin.

Same-origin is a requirement, not a preference: the session token
(`localStorage`), the Dexie cache (IndexedDB), and the service worker
registration are all origin-scoped. Splitting the landing page onto a separate
hostname would strand all three on the app subdomain.

---

## DNS

At the registrar, for `pointbreaklab.com`:

**A records** (apex → GitHub Pages)

```
185.199.108.153
185.199.109.153
185.199.110.153
185.199.111.153
```

**AAAA records** (IPv6, optional but recommended)

```
2606:50c0:8000::153
2606:50c0:8001::153
2606:50c0:8002::153
2606:50c0:8003::153
```

**CNAME**: `www` → `<github-username>.github.io`

GitHub Pages redirects `www` to the apex automatically once the apex is set as
the custom domain in repository settings.

### `app.pointbreaklab.com`

Pages serves exactly one custom hostname, so an `app` subdomain pointed at it
returns a 404 rather than the site. If you want that hostname to work, make it
an **HTTP redirect at the DNS provider**, not a CNAME to Pages. On Cloudflare
(already in use for the receipt Worker) that is a Redirect Rule:

```
app.pointbreaklab.com/*  →  https://pointbreaklab.com/app/$1   (301)
```

---

## GitHub Pages settings

1. Settings → Pages → Source: **GitHub Actions**
2. Settings → Pages → Custom domain: `pointbreaklab.com`
3. Wait for the DNS check, then tick **Enforce HTTPS**

`static/CNAME` is committed so the domain survives every deploy. Without it
Pages drops the custom domain each time the artifact is republished.

## Build variables

The workflow reads these from **repository variables** (Settings → Secrets and
variables → Actions → Variables). None are secret; they are public identifiers
compiled into the client bundle.

| Variable | Purpose |
|---|---|
| `PUBLIC_GITHUB_CLIENT_ID` | OAuth app client id for Device Flow |
| `PUBLIC_DATA_REPO` | `owner/repo` holding the JSON data |
| `PUBLIC_RECEIPT_PUBKEY` | Ed25519 public key receipts verify against |
| `PUBLIC_WORKER_URL` | Receipt Worker origin |

## Worker

Deployed separately from the Pages site:

```bash
npm run worker:deploy
```

Secrets are set with `wrangler secret put` and never committed:
`STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `RECEIPT_SIGNING_KEY`,
`GITHUB_APP_TOKEN`.

Set `ALLOWED_ORIGIN` in `worker/wrangler.toml` to `https://pointbreaklab.com`
so CORS matches the single origin above.
