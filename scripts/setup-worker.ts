#!/usr/bin/env tsx
/**
 * One-time Worker setup.
 *
 *   npm run worker:setup
 *
 * Creates the KV namespaces, writes their ids into worker/wrangler.toml, and
 * generates the two secrets that should be machine-generated rather than chosen
 * by a person.
 *
 * Generated keys are piped straight into `wrangler secret put` and are never
 * printed, never written to disk, and never passed as an argv value where they
 * would land in shell history or a process list. The Ed25519 public key is
 * printed, because that one is meant to be public.
 *
 * GITHUB_APP_TOKEN is deliberately not handled here. It is a credential only
 * you should ever see, so the script prints the one command for you to run.
 */

import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as ed from '@noble/ed25519';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const CONFIG = join(ROOT, 'worker/wrangler.toml');
const BINDING = 'GUARD';
const TITLE = 'pointbreak-worker-GUARD';

class WranglerError extends Error {
  constructor(
    readonly args: string[],
    readonly output: string
  ) {
    super(`wrangler ${args.join(' ')} failed`);
  }
}

function wrangler(args: string[], input?: string): string {
  try {
    return execFileSync('npx', ['wrangler', ...args], {
      cwd: ROOT,
      encoding: 'utf8',
      input,
      stdio: ['pipe', 'pipe', 'pipe']
    });
  } catch (e) {
    const err = e as { stdout?: string; stderr?: string };
    throw new WranglerError(args, `${err.stdout ?? ''}${err.stderr ?? ''}`);
  }
}

/** Strips ANSI so messages can be matched and reprinted cleanly. */
function plain(text: string): string {
  return text.replace(/\u001b\[[0-9;]*m/g, '');
}

function fail(message: string): never {
  console.error(`\x1b[31merror\x1b[0m ${message}`);
  process.exit(1);
}

function step(message: string): void {
  console.log(`\x1b[36m>\x1b[0m ${message}`);
}

process.on('uncaughtException', (e) => {
  if (e instanceof WranglerError) {
    fail(`${e.message}\n\n${plain(e.output).trim().split('\n').map((l) => `  ${l}`).join('\n')}`);
  }
  fail(e instanceof Error ? e.message : String(e));
});

/* ---------- Preflight ---------- */

step('checking Cloudflare authentication');

// `wrangler whoami` exits 0 whether or not you are signed in, so the exit code
// says nothing and the output has to be read.
let who = '';
try {
  who = plain(wrangler(['whoami']));
} catch (e) {
  who = e instanceof WranglerError ? plain(e.output) : '';
}

if (!who.includes('You are logged in') && !who.match(/[\w.+-]+@[\w.-]+/)) {
  fail(
    'not authenticated with Cloudflare.\n\n' +
      '  This shell is non-interactive, so `wrangler login` cannot open a browser here.\n' +
      '  Pick one:\n\n' +
      '    a) In your own terminal:  npx wrangler login\n' +
      '       Then re-run:           npm run worker:setup\n\n' +
      '    b) Create an API token with the "Edit Cloudflare Workers" template at\n' +
      '       https://dash.cloudflare.com/profile/api-tokens\n' +
      '       then:  export CLOUDFLARE_API_TOKEN=...  &&  npm run worker:setup\n'
  );
}
console.log(`  ${who.match(/[\w.+-]+@[\w.-]+/)?.[0] ?? 'authenticated'}`);

/* ---------- KV namespaces ---------- */

interface KvNamespace {
  id: string;
  title: string;
}

function existingNamespaces(): KvNamespace[] {
  try {
    return JSON.parse(wrangler(['kv', 'namespace', 'list'])) as KvNamespace[];
  } catch {
    return [];
  }
}

function idFromCreateOutput(output: string): string {
  const id = output.match(/id\s*=\s*"([0-9a-f]{32})"/)?.[1] ?? output.match(/"id":\s*"([0-9a-f]{32})"/)?.[1];
  if (!id) fail(`could not read the namespace id from wrangler output:\n${output}`);
  return id;
}

function ensureNamespace(preview: boolean): string {
  const wanted = preview ? `${TITLE}_preview` : TITLE;
  const found = existingNamespaces().find((n) => n.title === wanted);

  if (found) {
    console.log(`  reusing ${wanted} (${found.id})`);
    return found.id;
  }

  step(`creating KV namespace ${wanted}`);
  const args = ['kv', 'namespace', 'create', BINDING, ...(preview ? ['--preview'] : [])];
  return idFromCreateOutput(wrangler(args));
}

step('setting up the guard namespace');
console.log('  holds only HMAC keys: claimed pairs, spent nonces, monthly counters');
const id = ensureNamespace(false);
const previewId = ensureNamespace(true);

step('writing namespace ids into worker/wrangler.toml');
let config = readFileSync(CONFIG, 'utf8');
config = config.replace(/id = "REPLACE_WITH_KV_ID"/, `id = "${id}"`);
config = config.replace(/preview_id = "REPLACE_WITH_PREVIEW_KV_ID"/, `preview_id = "${previewId}"`);

if (config.includes('REPLACE_WITH')) {
  console.log('  placeholders already replaced, leaving the file alone');
} else {
  writeFileSync(CONFIG, config);
  console.log(`  id = ${id}`);
}

/* ---------- Generated secrets ---------- */

function putSecret(name: string, value: string): void {
  step(`setting ${name}`);
  wrangler(['secret', 'put', name, '--config', 'worker/wrangler.toml'], value);
}

function randomBase64(bytes: number): string {
  return Buffer.from(crypto.getRandomValues(new Uint8Array(bytes))).toString('base64');
}

// HMAC key for append tokens and guard keys. Rotating it invalidates every
// outstanding token and every sybil guard, so it is generated once.
putSecret('TOKEN_SIGNING_KEY', randomBase64(32));

// Ed25519 signing key for payment receipts. The private half never leaves this
// process; the public half is printed because clients verify against it.
const privateKey = crypto.getRandomValues(new Uint8Array(32));
const publicKey = await ed.getPublicKeyAsync(privateKey);
putSecret('RECEIPT_SIGNING_KEY', Buffer.from(privateKey).toString('base64'));
privateKey.fill(0);

const publicKeyB64 = Buffer.from(publicKey).toString('base64');

/* ---------- What is left ---------- */

const remaining = ['GITHUB_APP_TOKEN', 'STRIPE_SECRET_KEY', 'STRIPE_WEBHOOK_SECRET'];
let alreadySet: string[] = [];
try {
  alreadySet = (JSON.parse(wrangler(['secret', 'list', '--config', 'worker/wrangler.toml'])) as Array<{
    name: string;
  }>).map((s) => s.name);
} catch {
  // Listing is a convenience; not being able to is not a failure.
}

const missing = remaining.filter((name) => !alreadySet.includes(name));

console.log('\n\x1b[32mdone\x1b[0m  namespaces and generated secrets are in place.\n');
console.log('Set this as the PUBLIC_RECEIPT_PUBKEY repository variable:');
console.log(`  ${publicKeyB64}\n`);

if (missing.includes('GITHUB_APP_TOKEN')) {
  console.log('Still needed, and only you should see it:\n');
  console.log('  1. Create a fine-grained personal access token at');
  console.log('     https://github.com/settings/personal-access-tokens/new');
  console.log('       Resource owner:  pointbreaklab-hub');
  console.log('       Repository:      pointbreaklab-hub/pointbreak-data  (only this one)');
  console.log('       Permissions:     Contents: Read and write');
  console.log('     Nothing else. This token is the only credential that can write the ledger.\n');
  console.log('  2. Paste it into the prompt from:');
  console.log('     npx wrangler secret put GITHUB_APP_TOKEN --config worker/wrangler.toml\n');
}

if (missing.some((n) => n.startsWith('STRIPE'))) {
  console.log('Optional until you take payments: STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET.');
  console.log('Ledger writes do not touch them.\n');
}

console.log('Then deploy:');
console.log('  npm run worker:deploy');
