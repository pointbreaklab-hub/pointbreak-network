# Ledger service

The only server in PointBreak, and it is optional. Roughly 400 lines of
Web-standard JavaScript with no vendor SDK, no platform lock-in and no managed
service behind it. Run it on a laptop, a VPS, or in a container.

Nothing here is required to use the app. Reading, scoring, and local tracking
all work without it. It exists only when you want events published to a shared
public ledger.

## Why it has to exist at all

A Git commit carries its author.

If candidates committed their own applications to `pointbreak-data`, then
`git log` would map every pseudonymous `application_ref` back to a real person,
and an employer could read an employee's entire job search out of a public
repository. Setting the commit `author` field does not help, because GitHub
records the authenticated pusher regardless, and fork-and-PR leaks identically
through the PR author.

So pseudonymous append to a shared public log cannot be done with the
candidate's own credentials. Something else has to commit, and this is the
smallest thing that can.

## What it can and cannot see

Issuance and append are separate requests, and neither carries both halves:

| Route | Learns | Does not learn |
|---|---|---|
| `POST /ledger/token` | which account wants to act on which posting | the application ref |
| `POST /ledger/append` | a ref and an event | whose it is |
| `POST /attest` | voucher, subject, skill | nothing hidden, vouches are public by design |

Correlating issuance with append would mean logging across requests. It does
not, and you are reading the source.

That is an operational promise, not a cryptographic one. The honest mitigation
is that you run it yourself, so the only party you trust is you. The real fix is
a blind signature scheme, where the signer cannot recognise the token it signed.

## Running it

```bash
npm run keygen          # prints a TOKEN_SIGNING_KEY
cp server/.env.example server/.env
# fill in GITHUB_TOKEN and TOKEN_SIGNING_KEY
npm run server
```

Or with Docker:

```bash
docker build -t pointbreak-ledger server/
docker run -p 8787:8787 --env-file server/.env -v "$PWD/data:/app/data" pointbreak-ledger
```

Then point the client at it by setting `PUBLIC_LEDGER_URL` and
`PUBLIC_PUBLISH_LEDGER=true` at build time.

## Configuration

| Variable | Required | Default | Purpose |
|---|---|---|---|
| `GITHUB_TOKEN` | yes | | Writes the ledger. Scope it to the data repo alone |
| `TOKEN_SIGNING_KEY` | yes | | HMAC key for append tokens and guard keys |
| `DATA_REPO` | no | `pointbreaklab-hub/pointbreak-data` | Where events are committed |
| `ALLOWED_ORIGIN` | no | `*` | CORS origin. Set it in production |
| `MIN_ACCOUNT_AGE_DAYS` | no | `30` | Sybil guard |
| `MONTHLY_APPEND_BUDGET` | no | `60` | Sybil guard |
| `PORT` | no | `8787` | |
| `STORE_PATH` | no | `./data/guard.json` | Guard store location |

`GITHUB_TOKEN` is the only credential that can write the ledger. Use a
**fine-grained** token limited to `pointbreak-data` with Contents: read and
write. A classic token with `repo` scope would also work and would be a mistake,
since it would let the service write every repository the account can reach.

Rotating `TOKEN_SIGNING_KEY` invalidates every outstanding token and every sybil
guard, so treat it as permanent.

## The guard store

A JSON file holding opaque HMAC keys: which account-and-posting pairs are
claimed, which nonces are spent, and monthly counters. No logins, no job ids, no
application refs, so a dump of it deanonymises nobody.

It replaced Cloudflare KV. A database would be ceremony for a few thousand short
strings, and a file means `npm run server` is a complete deployment. Writes use
an atomic rename, so a crash mid-write leaves the previous file intact.

Back it up. Losing it resets every sybil guard, letting accounts re-claim
postings they already acted on.

## Portability

`src/handler.ts` takes a `Request` and returns a `Response`, with no Node
imports. `src/node.ts` is the only runtime-specific file, about sixty lines
bridging `node:http`. Porting to Deno or Bun means replacing that one file.
