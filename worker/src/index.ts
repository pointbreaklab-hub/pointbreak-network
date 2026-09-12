/**
 * PointBreak Worker
 *
 * The only server in the architecture. It does three jobs:
 *
 *   1. Verifies Stripe webhooks and signs payment receipts.
 *   2. Commits to the public ledger on everyone's behalf.
 *   3. Rate-limits who may append, which is what makes squad counts mean
 *      anything.
 *
 * Why it writes the ledger instead of the candidate
 * -------------------------------------------------
 * A Git commit carries its author. If a candidate committed their own
 * application, `git log` would map every pseudonymous application_ref back to a
 * real person, and a current employer could read an employee's entire job
 * search out of a public repo. Setting the `author` field does not help: GitHub
 * records the authenticated pusher regardless.
 *
 * So pseudonymous append to a shared public ledger cannot be done with the
 * candidate's own credentials. Something else has to commit, and this is it.
 *
 * The trust this costs, stated plainly
 * ------------------------------------
 * Issuance and append are deliberately split so this Worker never sees a login
 * and an application_ref in the same request. At issuance it learns that an
 * account wants to act on a job. At append it learns a ref and an event, with
 * no idea whose. Correlating the two would require logging across requests,
 * which it does not do, and the source is in this repository so you can check.
 *
 * That is still weaker than a cryptographic guarantee. The real fix is a blind
 * signature scheme, where the Worker signs a token it cannot recognise later.
 * That is the intended replacement and is tracked in the roadmap.
 */

export interface Env {
  DATA_REPO: string;
  ALLOWED_ORIGIN: string;
  MIN_ACCOUNT_AGE_DAYS: string;
  MONTHLY_APPEND_BUDGET: string;
  STRIPE_SECRET_KEY: string;
  STRIPE_WEBHOOK_SECRET: string;
  RECEIPT_SIGNING_KEY: string;
  GITHUB_APP_TOKEN: string;
  TOKEN_SIGNING_KEY: string;
  /** Opaque keys only: sybil guards and spent nonces. Never logins or refs. */
  GUARD: KVNamespace;
}

const GITHUB_API = 'https://api.github.com';
const TOKEN_TTL_SECONDS = 900;

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders(env) });
    }

    try {
      switch (`${request.method} ${url.pathname}`) {
        case 'GET /health':
          return json({ ok: true }, env);

        case 'GET /pubkey':
          return json({ publicKey: await publicKeyFrom(env.RECEIPT_SIGNING_KEY) }, env);

        case 'POST /webhook/stripe':
          return handleStripeWebhook(request, env);

        case 'POST /ledger/token':
          return handleTokenRequest(request, env);

        case 'POST /ledger/append':
          return handleAppend(request, env);

        case 'POST /attest':
          return handleAttest(request, env);

        default:
          return json({ error: 'not_found' }, env, 404);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'internal_error';
      return json({ error: message }, env, error instanceof HttpError ? error.status : 500);
    }
  }
};

class HttpError extends Error {
  constructor(
    message: string,
    readonly status: number
  ) {
    super(message);
  }
}

/* ---------- Identity, used only at issuance ---------- */

interface GhUser {
  login: string;
  created_at: string;
}

/**
 * Verifies the caller's GitHub token and returns who they are.
 *
 * Only ever called from issuance and attestation. The append path must not use
 * this, because knowing the login there is exactly what would let a ref be tied
 * to a person.
 */
async function identify(request: Request): Promise<GhUser> {
  const auth = request.headers.get('authorization');
  if (!auth?.startsWith('Bearer ')) throw new HttpError('missing_token', 401);

  const res = await fetch(`${GITHUB_API}/user`, {
    headers: { authorization: auth, accept: 'application/vnd.github+json', 'user-agent': 'pointbreak' }
  });
  if (!res.ok) throw new HttpError('bad_github_token', 401);

  return (await res.json()) as GhUser;
}

/**
 * Throwaway accounts are the cheapest way to manufacture consensus, so an
 * account has to have existed for a while before it can move any number.
 */
function assertAccountOldEnough(user: GhUser, env: Env): void {
  const ageDays = (Date.now() - Date.parse(user.created_at)) / 86_400_000;
  const minimum = Number(env.MIN_ACCOUNT_AGE_DAYS || 30);

  if (ageDays < minimum) {
    throw new HttpError(`account_too_new: needs ${Math.ceil(minimum - ageDays)} more days`, 403);
  }
}

/* ---------- Token issuance ---------- */

interface TokenClaims {
  job_id: string;
  nonce: string;
  exp: number;
  scope: 'ledger' | 'attest';
}

/**
 * One token per account per posting.
 *
 * This is the sybil guard. Without it a single person could mint twenty
 * application refs against one job and inflate its squad count, which would
 * make the most visible number in the product worthless.
 *
 * The guard key is an HMAC of login and job id, so the store holds no login,
 * no job id and no ref. It answers exactly one question: has this pair been
 * seen before.
 */
async function handleTokenRequest(request: Request, env: Env): Promise<Response> {
  const { job_id, scope = 'ledger' } = (await request.json()) as {
    job_id?: string;
    scope?: 'ledger' | 'attest';
  };
  if (!job_id) throw new HttpError('job_id_required', 400);

  const user = await identify(request);
  assertAccountOldEnough(user, env);

  const guardKey = `claimed:${await hmacHex(env.TOKEN_SIGNING_KEY, `${user.login}|${job_id}|${scope}`)}`;
  if (await env.GUARD.get(guardKey)) {
    throw new HttpError('already_claimed: this account already acted on this posting', 409);
  }

  // A monthly ceiling bounds the damage if someone farms aged accounts.
  const budgetKey = `budget:${await hmacHex(env.TOKEN_SIGNING_KEY, `${user.login}|${monthStamp()}`)}`;
  const spent = Number((await env.GUARD.get(budgetKey)) ?? 0);
  const budget = Number(env.MONTHLY_APPEND_BUDGET || 60);
  if (spent >= budget) throw new HttpError('monthly_budget_exhausted', 429);

  const claims: TokenClaims = {
    job_id,
    nonce: crypto.randomUUID(),
    exp: Math.floor(Date.now() / 1000) + TOKEN_TTL_SECONDS,
    scope
  };

  // Marked before the token is handed out. Failing closed here costs the user a
  // retry; failing open would hand out unlimited tokens.
  await env.GUARD.put(guardKey, '1');
  await env.GUARD.put(budgetKey, String(spent + 1), { expirationTtl: 60 * 60 * 24 * 40 });

  return json({ token: await signToken(claims, env.TOKEN_SIGNING_KEY), expires_in: TOKEN_TTL_SECONDS }, env);
}

async function signToken(claims: TokenClaims, key: string): Promise<string> {
  const body = btoa(JSON.stringify(claims)).replace(/=+$/, '');
  return `${body}.${await hmacHex(key, body)}`;
}

async function verifyToken(token: string, key: string): Promise<TokenClaims> {
  const [body, signature] = token.split('.');
  if (!body || !signature) throw new HttpError('malformed_token', 400);
  if (!timingSafeEqual(await hmacHex(key, body), signature)) {
    throw new HttpError('bad_token_signature', 401);
  }

  const claims = JSON.parse(atob(body)) as TokenClaims;
  if (claims.exp < Date.now() / 1000) throw new HttpError('token_expired', 401);

  return claims;
}

/* ---------- Ledger append ---------- */

const CANDIDATE_ACTIONS = new Set([
  'application_submitted',
  'rejection_received',
  'interview_held',
  'offer_received',
  'withdrawn',
  'claim_confirmed',
  'claim_disputed'
]);

interface LedgerEventInput {
  job_id: string;
  application_ref: string;
  action: string;
  at: string;
  actor: string;
  ref_event?: string;
}

/**
 * Appends one candidate-authored event.
 *
 * Note what is absent: no call to identify(). This request is authorised by the
 * token alone, so the Worker handles a ref and an event without learning whose
 * they are.
 */
async function handleAppend(request: Request, env: Env): Promise<Response> {
  const { token, event } = (await request.json()) as { token?: string; event?: LedgerEventInput };
  if (!token || !event) throw new HttpError('token_and_event_required', 400);

  const claims = await verifyToken(token, env.TOKEN_SIGNING_KEY);
  if (claims.scope !== 'ledger') throw new HttpError('wrong_token_scope', 403);
  if (claims.job_id !== event.job_id) throw new HttpError('token_job_mismatch', 403);

  // Single use. Without this one token could append an unbounded stream.
  const spentKey = `spent:${claims.nonce}`;
  if (await env.GUARD.get(spentKey)) throw new HttpError('token_already_used', 409);

  if (!/^app_[0-9a-f]{32}$/.test(event.application_ref)) {
    throw new HttpError('bad_application_ref', 400);
  }
  if (event.actor !== 'candidate' || !CANDIDATE_ACTIONS.has(event.action)) {
    // Company claims arrive on an authenticated company route, not here. A
    // candidate must never be able to append a company claim about itself.
    throw new HttpError('action_not_permitted_on_this_route', 403);
  }

  const line = JSON.stringify({
    id: `ev_${crypto.randomUUID().replace(/-/g, '').slice(0, 16)}`,
    job_id: event.job_id,
    application_ref: event.application_ref,
    action: event.action,
    // Server time. A client-supplied timestamp could backdate silence.
    at: new Date().toISOString(),
    actor: 'candidate',
    ...(event.ref_event ? { ref_event: event.ref_event } : {})
  });

  await appendLine(env, `events/${event.job_id}.jsonl`, line, `ledger: ${event.action}`);
  await env.GUARD.put(spentKey, '1', { expirationTtl: TOKEN_TTL_SECONDS + 60 });

  return json({ ok: true }, env);
}

/* ---------- Peer attestation ---------- */

interface AttestInput {
  subject: string;
  skill: string;
  note?: string;
}

/**
 * A peer vouch, and the one place identity is the point.
 *
 * An anonymous vouch is worth nothing, so these carry the voucher's real
 * GitHub login. That is why this route calls identify() and the append route
 * does not.
 */
async function handleAttest(request: Request, env: Env): Promise<Response> {
  const { subject, skill, note } = (await request.json()) as AttestInput;
  if (!subject || !skill) throw new HttpError('subject_and_skill_required', 400);
  if (note && note.length > 500) throw new HttpError('note_too_long', 400);

  const user = await identify(request);
  assertAccountOldEnough(user, env);

  if (user.login.toLowerCase() === subject.toLowerCase()) {
    throw new HttpError('cannot_vouch_for_yourself', 403);
  }

  const guardKey = `vouched:${await hmacHex(
    env.TOKEN_SIGNING_KEY,
    `${user.login}|${subject.toLowerCase()}|${skill.toLowerCase()}`
  )}`;
  if (await env.GUARD.get(guardKey)) {
    throw new HttpError('already_vouched_for_this_skill', 409);
  }

  const line = JSON.stringify({
    id: `att_${crypto.randomUUID().replace(/-/g, '').slice(0, 16)}`,
    subject: subject.toLowerCase(),
    skill,
    note: note ?? '',
    attested_by: user.login,
    at: new Date().toISOString()
  });

  await appendLine(
    env,
    `attestations/${subject.toLowerCase()}.jsonl`,
    line,
    `attest: ${user.login} vouches ${subject} on ${skill}`
  );
  await env.GUARD.put(guardKey, '1');

  return json({ ok: true }, env);
}

/* ---------- Git append ---------- */

/**
 * Appends a line to a JSONL file in the data repo.
 *
 * The contents API has no append, so this is read, modify, write against a sha.
 * Concurrent writers make 409s normal rather than exceptional, so a conflict
 * refetches and retries instead of failing.
 */
async function appendLine(env: Env, path: string, line: string, message: string): Promise<void> {
  for (let attempt = 0; attempt < 4; attempt++) {
    const existing = await getFile(env, path);
    const body = existing ? `${existing.text.replace(/\n*$/, '')}\n${line}\n` : `${line}\n`;

    const res = await fetch(`${GITHUB_API}/repos/${env.DATA_REPO}/contents/${path}`, {
      method: 'PUT',
      headers: githubHeaders(env),
      body: JSON.stringify({
        message,
        content: base64Encode(body),
        ...(existing ? { sha: existing.sha } : {})
      })
    });

    if (res.ok) return;
    if (res.status !== 409 && res.status !== 422) {
      throw new HttpError(`git_write_failed: ${res.status} ${await res.text()}`, 502);
    }

    // Someone else committed between the read and the write.
    await new Promise((r) => setTimeout(r, 80 * (attempt + 1)));
  }

  throw new HttpError('git_write_conflict: too many concurrent writers', 503);
}

async function getFile(env: Env, path: string): Promise<{ text: string; sha: string } | null> {
  const res = await fetch(`${GITHUB_API}/repos/${env.DATA_REPO}/contents/${path}`, {
    headers: githubHeaders(env)
  });
  if (res.status === 404) return null;
  if (!res.ok) throw new HttpError(`git_read_failed: ${res.status}`, 502);

  const body = (await res.json()) as { content: string; sha: string };
  return { text: base64Decode(body.content), sha: body.sha };
}

function githubHeaders(env: Env): Record<string, string> {
  return {
    authorization: `Bearer ${env.GITHUB_APP_TOKEN}`,
    accept: 'application/vnd.github+json',
    'x-github-api-version': '2022-11-28',
    'user-agent': 'pointbreak-worker',
    'content-type': 'application/json'
  };
}

/* ---------- Stripe ---------- */

async function handleStripeWebhook(request: Request, env: Env): Promise<Response> {
  const signature = request.headers.get('stripe-signature');
  const body = await request.text();

  if (!signature || !(await verifyStripeSignature(body, signature, env.STRIPE_WEBHOOK_SECRET))) {
    return json({ error: 'invalid_signature' }, env, 400);
  }

  const event = JSON.parse(body) as { type: string; data: { object: Record<string, unknown> } };
  if (event.type !== 'checkout.session.completed') return json({ received: true }, env);

  // TODO: build the receipt from the session metadata, sign it with
  // RECEIPT_SIGNING_KEY, and commit it to receipts/<id>.json.
  return json({ received: true }, env);
}

/** Stripe signs webhooks as HMAC-SHA256 over `${timestamp}.${payload}`. */
async function verifyStripeSignature(
  payload: string,
  header: string,
  secret: string
): Promise<boolean> {
  const parts = Object.fromEntries(
    header.split(',').map((kv) => kv.split('=', 2) as [string, string])
  );
  const timestamp = parts['t'];
  const expected = parts['v1'];
  if (!timestamp || !expected) return false;

  // Reject anything older than five minutes to blunt replay attacks.
  const age = Math.abs(Date.now() / 1000 - Number(timestamp));
  if (!Number.isFinite(age) || age > 300) return false;

  return timingSafeEqual(await hmacHex(secret, `${timestamp}.${payload}`), expected);
}

async function publicKeyFrom(_signingKey: string): Promise<string> {
  // TODO: derive the Ed25519 public key from RECEIPT_SIGNING_KEY.
  return '';
}

/* ---------- Primitives ---------- */

async function hmacHex(secret: string, message: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const mac = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(message));
  return [...new Uint8Array(mac)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

function monthStamp(): string {
  return new Date().toISOString().slice(0, 7);
}

function base64Encode(text: string): string {
  const bytes = new TextEncoder().encode(text);
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function base64Decode(base64: string): string {
  const binary = atob(base64.replace(/\s/g, ''));
  const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

function corsHeaders(env: Env): Record<string, string> {
  return {
    'Access-Control-Allow-Origin': env.ALLOWED_ORIGIN,
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'content-type, authorization, stripe-signature'
  };
}

function json(body: unknown, env: Env, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json', ...corsHeaders(env) }
  });
}
