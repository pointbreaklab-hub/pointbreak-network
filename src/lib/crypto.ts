/**
 * Ed25519 receipt signing and verification.
 *
 * Signing happens only in the Worker (the key never reaches a browser).
 * Verification happens only here, in the client, so no one has to trust the
 * Worker's word that a receipt is genuine.
 */

import * as ed from '@noble/ed25519';
import type { Receipt } from './types';

/**
 * Deterministic JSON: sorted keys, no whitespace.
 * Signer and verifier must produce byte-identical input or every check fails.
 */
export function canonicalize(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalize).join(',')}]`;

  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([, v]) => v !== undefined)
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([k, v]) => `${JSON.stringify(k)}:${canonicalize(v)}`);

  return `{${entries.join(',')}}`;
}

/** The signed payload is the receipt minus its own signature. */
export function receiptPayload(receipt: Receipt): Uint8Array {
  const { signature: _signature, ...rest } = receipt;
  return new TextEncoder().encode(canonicalize(rest));
}

export async function verifyReceipt(receipt: Receipt, publicKeyB64: string): Promise<boolean> {
  try {
    return await ed.verifyAsync(
      fromBase64(receipt.signature),
      receiptPayload(receipt),
      fromBase64(publicKeyB64)
    );
  } catch {
    return false;
  }
}

/** Worker-side only. Never call this with a key that came from the network. */
export async function signReceipt(
  receipt: Omit<Receipt, 'signature'>,
  privateKeyB64: string
): Promise<Receipt> {
  const full = { ...receipt, signature: '' } as Receipt;
  const sig = await ed.signAsync(receiptPayload(full), fromBase64(privateKeyB64));
  return { ...receipt, signature: toBase64(sig) };
}

export function toBase64(bytes: Uint8Array): string {
  return btoa(String.fromCharCode(...bytes));
}

export function fromBase64(value: string): Uint8Array {
  return Uint8Array.from(atob(value), (c) => c.charCodeAt(0));
}
