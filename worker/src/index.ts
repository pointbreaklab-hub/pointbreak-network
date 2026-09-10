/**
 * PointBreak Receipt Signer
 *
 * The only external server in the network. Deliberately tiny and stateless.
 *
 *   POST /webhook/stripe  -> verify Stripe signature, sign a receipt, commit to Git
 *   GET  /pubkey          -> the Ed25519 public key clients verify receipts against
 *   GET  /health          -> liveness
 *
 * Invariant: this worker never persists data. Git is the database.
 */

export interface Env {
  DATA_REPO: string;
  ALLOWED_ORIGIN: string;
  STRIPE_SECRET_KEY: string;
  STRIPE_WEBHOOK_SECRET: string;
  RECEIPT_SIGNING_KEY: string;
  GITHUB_APP_TOKEN: string;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders(env) });
    }

    switch (`${request.method} ${url.pathname}`) {
      case 'GET /health':
        return json({ ok: true }, env);

      case 'GET /pubkey':
        return json({ publicKey: await publicKeyFrom(env.RECEIPT_SIGNING_KEY) }, env);

      case 'POST /webhook/stripe':
        return handleStripeWebhook(request, env);

      default:
        return json({ error: 'not_found' }, env, 404);
    }
  }
};

async function handleStripeWebhook(request: Request, env: Env): Promise<Response> {
  const signature = request.headers.get('stripe-signature');
  const body = await request.text();

  if (!signature || !(await verifyStripeSignature(body, signature, env.STRIPE_WEBHOOK_SECRET))) {
    return json({ error: 'invalid_signature' }, env, 400);
  }

  const event = JSON.parse(body) as { type: string; data: { object: Record<string, unknown> } };

  if (event.type !== 'checkout.session.completed') {
    // Acknowledge everything else so Stripe stops retrying.
    return json({ received: true }, env);
  }

  // TODO: build the receipt from the checkout session metadata
  //   - jobId, companyId, tier, amount, currency, paidAt
  // TODO: sign it with RECEIPT_SIGNING_KEY (Ed25519)
  // TODO: commit the signed receipt to DATA_REPO via the GitHub contents API
  //       so the client can verify it without trusting this worker

  return json({ received: true }, env);
}

/**
 * Stripe signs webhooks as HMAC-SHA256 over `${timestamp}.${payload}`.
 * Verified here with WebCrypto so the worker has no Node dependency.
 */
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

  // Reject anything older than 5 minutes to blunt replay attacks.
  const age = Math.abs(Date.now() / 1000 - Number(timestamp));
  if (!Number.isFinite(age) || age > 300) return false;

  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const mac = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(`${timestamp}.${payload}`));

  return timingSafeEqual(toHex(new Uint8Array(mac)), expected);
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

function toHex(bytes: Uint8Array): string {
  return [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('');
}

async function publicKeyFrom(_signingKey: string): Promise<string> {
  // TODO: derive the Ed25519 public key from RECEIPT_SIGNING_KEY
  return '';
}

function corsHeaders(env: Env): Record<string, string> {
  return {
    'Access-Control-Allow-Origin': env.ALLOWED_ORIGIN,
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'content-type, stripe-signature'
  };
}

function json(body: unknown, env: Env, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json', ...corsHeaders(env) }
  });
}
