/**
 * PointBreak ledger service.
 *
 * Plain Web-standard Request in, Response out. No vendor runtime, no platform
 * SDK. It runs on Node, Deno or Bun, in a container, or on a laptop.
 *
 * Why it exists at all
 * -------------------
 * A Git commit carries its author. If a candidate committed their own
 * application, `git log` on the public data repo would map every pseudonymous
 * application_ref back to a real person, and an employer could read an
 * employee's entire job search. Setting the `author` field does not help,
 * because GitHub records the authenticated pusher regardless, and fork-and-PR
 * leaks the same way through the PR author.
 *
 * So pseudonymous append to a shared public log cannot use the candidate's own
 * credentials. Something else has to commit, and this is the smallest thing
 * that can.
 *
 * The trust this costs, stated plainly
 * ------------------------------------
 * Issuance and append are separate requests so this service never sees a login
 * and an application_ref together. At issuance it learns that an account wants
 * to act on a posting. At append it learns a ref and an event, with no idea
 * whose. Correlating them would mean logging across requests, which it does not
 * do, and you are reading the source.
 *
 * That is an operational promise rather than a cryptographic one. The real fix
 * is a blind signature scheme, where the signer cannot recognise the token it
 * signed. Until then, running this yourself is the mitigation: the only party
 * you have to trust is you.
 */

import type { Store } from './store.js';

export interface Config {
  dataRepo: string;
  allowedOrigin: string;
  minAccountAgeDays: number;
  monthlyAppendBudget: number;
  githubToken: string;
  tokenSigningKey: string;
  stripeWebhookSecret?: string;
  receiptSigningKey?: string;
}

const GITHUB_API = 'https://api.github.com';
const TOKEN_TTL_SECONDS = 900;

export class HttpError extends Error {
  constructor(
    message: string,
    readonly status: number
  ) {
    super(message);
  }
}

export function createHandler(config: Config, store: Store) {
  return async function handle(request: Request): Promise<Response> {
    const url = new URL(request.url);

    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: cors(config) });
    }

    try {
      switch (`${request.method} ${url.pathname}`) {
        case 'GET /health':
          return json({ ok: true, repo: config.dataRepo }, config);

        case 'POST /ledger/token':
          return await issueToken(request, config, store);

        case 'POST /ledger/append':
          return await append(request, config, store);

        case 'POST /attest':
          return await attest(request, config, store);

        default:
          return json({ error: 'not_found' }, config, 404);
      }
    } catch (error) {
      if (error instanceof HttpError) {
        return json({ error: error.message }, config, error.status);
      }
      // Never leak an internal stack to a caller.
      console.error('[handler]', error);
      return json({ error: 'internal_error' }, config, 500);
    }
  };
}

/* ---------- Identity, used only at issuance ---------- */

interface GhUser {
  login: string;
  created_at: string;
}

/**
 * Verifies the caller's GitHub token and returns who they are.
 *
 * Deliberately not called from the append route: knowing the login there is
 * precisely what would let a ref be tied to a person.
 */
async function identify(request: Request): Promise<GhUser> {
  const auth = request.headers.get('authorization');
  if (!auth?.startsWith('Bearer ')) throw new HttpError('missing_token', 401);

  const res = await fetch(`${GITHUB_API}/user`, {
    headers: {
      authorization: auth,
      accept: 'application/vnd.github+json',
      'user-agent': 'pointbreak-ledger'
    }
  });
  if (!res.ok) throw new HttpError('bad_github_token', 401);

  return (await res.json()) as GhUser;
}

/** Throwaway accounts are the cheapest way to manufacture consensus. */
function assertOldEnough(user: GhUser, config: Config): void {
  const ageDays = (Date.now() - Date.parse(user.created_at)) / 86_400_000;
  if (ageDays < config.minAccountAgeDays) {
    throw new HttpError(
      `account_too_new: needs ${Math.ceil(config.minAccountAgeDays - ageDays)} more days`,
      403
    );
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
 * One token per account per posting. This is the sybil guard: without it one
 * person could mint twenty refs against a single job and inflate the most
 * visible number in the product.
 *
 * The guard key is an HMAC of login and job id, so the store holds no login, no
 * job id and no ref. It answers one question: has this pair been seen.
 */
async function issueToken(request: Request, config: Config, store: Store): Promise<Response> {
  const { job_id, scope = 'ledger' } = (await request.json()) as {
    job_id?: string;
    scope?: 'ledger' | 'attest';
  };
  if (!job_id) throw new HttpError('job_id_required', 400);

  const user = await identify(request);
  assertOldEnough(user, config);

  const guardKey = `claimed:${await hmacHex(config.tokenSigningKey, `${user.login}|${job_id}|${scope}`)}`;
  if (await store.get(guardKey)) {
    throw new HttpError('already_claimed: this account already acted on this posting', 409);
  }

  const budgetKey = `budget:${await hmacHex(config.tokenSigningKey, `${user.login}|${monthStamp()}`)}`;
  const spent = Number((await store.get(budgetKey)) ?? 0);
  if (spent >= config.monthlyAppendBudget) throw new HttpError('monthly_budget_exhausted', 429);

  const claims: TokenClaims = {
    job_id,
    nonce: crypto.randomUUID(),
    exp: Math.floor(Date.now() / 1000) + TOKEN_TTL_SECONDS,
    scope
  };

  // Marked before the token is handed out. Failing here costs a retry; failing
  // open would hand out unlimited tokens.
  await store.put(guardKey, '1');
  await store.put(budgetKey, String(spent + 1), { ttlSeconds: 60 * 60 * 24 * 40 });

  return json(
    { token: await signToken(claims, config.tokenSigningKey), expires_in: TOKEN_TTL_SECONDS },
    config
  );
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

interface EventInput {
  job_id: string;
  application_ref: string;
  action: string;
  actor: string;
  ref_event?: string;
}

/**
 * Appends one candidate-authored event.
 *
 * Note the absence of identify(). This route is authorised by the token alone,
 * so the service handles a ref and an event without learning whose they are.
 */
async function append(request: Request, config: Config, store: Store): Promise<Response> {
  const { token, event } = (await request.json()) as { token?: string; event?: EventInput };
  if (!token || !event) throw new HttpError('token_and_event_required', 400);

  const claims = await verifyToken(token, config.tokenSigningKey);
  if (claims.scope !== 'ledger') throw new HttpError('wrong_token_scope', 403);
  if (claims.job_id !== event.job_id) throw new HttpError('token_job_mismatch', 403);

  const spentKey = `spent:${claims.nonce}`;
  if (await store.get(spentKey)) throw new HttpError('token_already_used', 409);

  if (!/^app_[0-9a-f]{32}$/.test(event.application_ref)) {
    throw new HttpError('bad_application_ref', 400);
  }
  if (event.actor !== 'candidate' || !CANDIDATE_ACTIONS.has(event.action)) {
    // Company claims arrive on an authenticated company route. A candidate must
    // never be able to append a company claim, in either direction.
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

  await appendLine(config, `events/${event.job_id}.jsonl`, line, `ledger: ${event.action}`);
  await store.put(spentKey, '1', { ttlSeconds: TOKEN_TTL_SECONDS + 60 });

  return json({ ok: true }, config);
}

/* ---------- Peer attestation ---------- */

/**
 * A peer vouch, and the one place identity is the point. An anonymous vouch is
 * worth nothing, so this route does call identify() and records a real login.
 */
async function attest(request: Request, config: Config, store: Store): Promise<Response> {
  const { subject, skill, note } = (await request.json()) as {
    subject?: string;
    skill?: string;
    note?: string;
  };
  if (!subject || !skill) throw new HttpError('subject_and_skill_required', 400);
  if (note && note.length > 500) throw new HttpError('note_too_long', 400);

  const user = await identify(request);
  assertOldEnough(user, config);

  if (user.login.toLowerCase() === subject.toLowerCase()) {
    throw new HttpError('cannot_vouch_for_yourself', 403);
  }

  const guardKey = `vouched:${await hmacHex(
    config.tokenSigningKey,
    `${user.login}|${subject.toLowerCase()}|${skill.toLowerCase()}`
  )}`;
  if (await store.get(guardKey)) throw new HttpError('already_vouched_for_this_skill', 409);

  const line = JSON.stringify({
    id: `att_${crypto.randomUUID().replace(/-/g, '').slice(0, 16)}`,
    subject: subject.toLowerCase(),
    skill,
    note: note ?? '',
    attested_by: user.login,
    at: new Date().toISOString()
  });

  await appendLine(
    config,
    `attestations/${subject.toLowerCase()}.jsonl`,
    line,
    `attest: ${user.login} vouches ${subject} on ${skill}`
  );
  await store.put(guardKey, '1');

  return json({ ok: true }, config);
}

/* ---------- Git append ---------- */

/**
 * Appends a line to a JSONL file in the data repo.
 *
 * The contents API has no append, so this is read, modify, write against a sha.
 * Concurrent writers make 409s normal rather than exceptional, so a conflict
 * refetches and retries instead of failing.
 */
async function appendLine(
  config: Config,
  path: string,
  line: string,
  message: string
): Promise<void> {
  for (let attempt = 0; attempt < 4; attempt++) {
    const existing = await getFile(config, path);
    const body = existing ? `${existing.text.replace(/\n*$/, '')}\n${line}\n` : `${line}\n`;

    const res = await fetch(`${GITHUB_API}/repos/${config.dataRepo}/contents/${path}`, {
      method: 'PUT',
      headers: githubHeaders(config),
      body: JSON.stringify({
        message,
        content: Buffer.from(body, 'utf8').toString('base64'),
        ...(existing ? { sha: existing.sha } : {})
      })
    });

    if (res.ok) return;
    if (res.status !== 409 && res.status !== 422) {
      throw new HttpError(`git_write_failed: ${res.status} ${await res.text()}`, 502);
    }

    await new Promise((r) => setTimeout(r, 80 * (attempt + 1)));
  }

  throw new HttpError('git_write_conflict: too many concurrent writers', 503);
}

async function getFile(
  config: Config,
  path: string
): Promise<{ text: string; sha: string } | null> {
  const res = await fetch(`${GITHUB_API}/repos/${config.dataRepo}/contents/${path}`, {
    headers: githubHeaders(config)
  });
  if (res.status === 404) return null;
  if (!res.ok) throw new HttpError(`git_read_failed: ${res.status}`, 502);

  const body = (await res.json()) as { content: string; sha: string };
  return { text: Buffer.from(body.content, 'base64').toString('utf8'), sha: body.sha };
}

function githubHeaders(config: Config): Record<string, string> {
  return {
    authorization: `Bearer ${config.githubToken}`,
    accept: 'application/vnd.github+json',
    'x-github-api-version': '2022-11-28',
    'user-agent': 'pointbreak-ledger',
    'content-type': 'application/json'
  };
}

/* ---------- Primitives ---------- */

export async function hmacHex(secret: string, message: string): Promise<string> {
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

function cors(config: Config): Record<string, string> {
  return {
    'Access-Control-Allow-Origin': config.allowedOrigin,
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'content-type, authorization'
  };
}

function json(body: unknown, config: Config, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json', ...cors(config) }
  });
}
