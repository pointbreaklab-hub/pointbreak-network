#!/usr/bin/env tsx
/**
 * Generates a TOKEN_SIGNING_KEY.
 *
 *   npm run keygen
 *
 * Printed rather than written anywhere, so it lands in your environment file
 * and nowhere else. Rotating it invalidates every outstanding append token and
 * every sybil guard, so generate once and keep it.
 */

const key = Buffer.from(crypto.getRandomValues(new Uint8Array(32))).toString('base64');

console.log('\nTOKEN_SIGNING_KEY=' + key + '\n');
console.log('Paste that into server/.env. Do not commit it.');
console.log('Rotating it resets every sybil guard, so treat it as permanent.\n');
