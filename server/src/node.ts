#!/usr/bin/env node
/**
 * Node entrypoint.
 *
 * Bridges node:http to the Web-standard handler, so the handler itself stays
 * runtime-agnostic and this file is the only part that would change to run on
 * Deno or Bun.
 */

import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { createHandler, type Config } from './handler.js';
import { FileStore } from './store.js';

function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    console.error(`error  ${name} is not set.`);
    console.error('       See server/README.md for what each value is and how to generate it.');
    process.exit(1);
  }
  return value;
}

const config: Config = {
  dataRepo: process.env.DATA_REPO ?? 'pointbreaklab-hub/pointbreak-data',
  allowedOrigin: process.env.ALLOWED_ORIGIN ?? '*',
  minAccountAgeDays: Number(process.env.MIN_ACCOUNT_AGE_DAYS ?? 30),
  monthlyAppendBudget: Number(process.env.MONTHLY_APPEND_BUDGET ?? 60),
  githubToken: required('GITHUB_TOKEN'),
  tokenSigningKey: required('TOKEN_SIGNING_KEY'),
  stripeWebhookSecret: process.env.STRIPE_WEBHOOK_SECRET,
  receiptSigningKey: process.env.RECEIPT_SIGNING_KEY
};

const port = Number(process.env.PORT ?? 8787);
const store = await FileStore.open(process.env.STORE_PATH ?? './data/guard.json');
const handle = createHandler(config, store);

/** node:http gives streams; the handler wants a Request. */
async function toRequest(req: IncomingMessage): Promise<Request> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) chunks.push(chunk as Buffer);

  const headers = new Headers();
  for (const [key, value] of Object.entries(req.headers)) {
    if (typeof value === 'string') headers.set(key, value);
    else if (Array.isArray(value)) headers.set(key, value.join(', '));
  }

  const host = req.headers.host ?? `localhost:${port}`;
  return new Request(`http://${host}${req.url ?? '/'}`, {
    method: req.method,
    headers,
    body: chunks.length ? Buffer.concat(chunks) : undefined
  });
}

const server = createServer((req: IncomingMessage, res: ServerResponse) => {
  void (async () => {
    try {
      const response = await handle(await toRequest(req));

      const outgoing: Record<string, string> = {};
      response.headers.forEach((value, key) => {
        outgoing[key] = value;
      });

      res.writeHead(response.status, outgoing);
      res.end(Buffer.from(await response.arrayBuffer()));
    } catch (error) {
      console.error('[server]', error);
      res.writeHead(500, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ error: 'internal_error' }));
    }
  })();
});

server.listen(port, () => {
  console.log(`pointbreak ledger service on :${port}`);
  console.log(`  data repo      ${config.dataRepo}`);
  console.log(`  allowed origin ${config.allowedOrigin}`);
  console.log(`  min account age ${config.minAccountAgeDays}d, budget ${config.monthlyAppendBudget}/month`);
});

// Flush the guard store before exiting, or the last writes are lost and a
// sybil guard could be forgotten.
for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.on(signal, () => {
    server.close();
    void store.close().then(() => process.exit(0));
  });
}
