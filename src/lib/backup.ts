/**
 * Passphrase-encrypted local backups.
 *
 * This file is the one artefact in the whole system that must never be readable
 * by anyone but its owner. The public ledger is pseudonymous precisely because
 * the mapping from an application_ref back to a person exists nowhere except
 * that person's own browser, and an export of local data *is* that mapping: the
 * refs, the jobs they point at, and the employer behind each one.
 *
 * A plaintext export puts it in a downloads folder, then a cloud sync, then an
 * email to yourself, and undoes what the rest of the design spends its effort
 * protecting. So an export is ciphertext or it is not written at all.
 *
 * Nobody holds the key. Not this app, not a server, not a recovery address.
 * A forgotten passphrase means a lost backup, which is the correct trade when
 * the alternative is a readable one.
 *
 * Standard primitives only, all from WebCrypto: PBKDF2-HMAC-SHA256 to turn a
 * passphrase into a key, AES-256-GCM to encrypt. GCM authenticates, so a wrong
 * passphrase fails loudly instead of returning plausible rubbish.
 */

import { fromBase64, toBase64 } from './crypto';

export const BACKUP_FORMAT = 'pointbreak-backup';

/**
 * A passphrase is the only thing between this file and whoever finds it, and
 * PBKDF2 is not memory-hard, so length is the defence that is actually
 * available here. Twelve characters is the floor, not a recommendation.
 */
export const MIN_PASSPHRASE_LENGTH = 12;

/** OWASP's floor for PBKDF2-HMAC-SHA256. Roughly a second on a laptop. */
const KDF_ITERATIONS = 600_000;

const SALT_BYTES = 16;
const IV_BYTES = 12;

export interface BackupEnvelope {
  format: typeof BACKUP_FORMAT;
  version: 1;
  /** Recorded rather than assumed, so a future change in cost can still open old files. */
  kdf: { name: 'PBKDF2'; hash: 'SHA-256'; iterations: number; salt: string };
  cipher: { name: 'AES-GCM'; iv: string };
  ciphertext: string;
}

export class BackupError extends Error {
  constructor(
    message: string,
    readonly code: string
  ) {
    super(message);
    this.name = 'BackupError';
  }
}

async function deriveKey(
  passphrase: string,
  salt: Uint8Array<ArrayBuffer>,
  iterations: number
): Promise<CryptoKey> {
  const material = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(passphrase),
    'PBKDF2',
    false,
    ['deriveKey']
  );

  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt, iterations, hash: 'SHA-256' },
    material,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

export async function encryptBackup(plaintext: string, passphrase: string): Promise<string> {
  if (passphrase.length < MIN_PASSPHRASE_LENGTH) {
    throw new BackupError(
      `Use at least ${MIN_PASSPHRASE_LENGTH} characters. This file maps your applications back to you, and the passphrase is the only thing protecting it.`,
      'passphrase_too_short'
    );
  }

  const salt = crypto.getRandomValues(new Uint8Array(SALT_BYTES));
  const iv = crypto.getRandomValues(new Uint8Array(IV_BYTES));
  const key = await deriveKey(passphrase, salt, KDF_ITERATIONS);

  const ciphertext = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    new TextEncoder().encode(plaintext)
  );

  const envelope: BackupEnvelope = {
    format: BACKUP_FORMAT,
    version: 1,
    kdf: { name: 'PBKDF2', hash: 'SHA-256', iterations: KDF_ITERATIONS, salt: toBase64(salt) },
    cipher: { name: 'AES-GCM', iv: toBase64(iv) },
    ciphertext: toBase64(new Uint8Array(ciphertext))
  };

  return JSON.stringify(envelope, null, 2);
}

/** True for anything written by encryptBackup, so import can tell the two apart. */
export function isEncryptedBackup(text: string): boolean {
  try {
    return (JSON.parse(text) as Partial<BackupEnvelope>).format === BACKUP_FORMAT;
  } catch {
    return false;
  }
}

export async function decryptBackup(text: string, passphrase: string): Promise<string> {
  let envelope: BackupEnvelope;
  try {
    envelope = JSON.parse(text) as BackupEnvelope;
  } catch {
    throw new BackupError('That file is not readable as a backup.', 'not_a_backup');
  }

  if (envelope.format !== BACKUP_FORMAT) {
    throw new BackupError('That file is not a PointBreak backup.', 'not_a_backup');
  }
  if (envelope.version !== 1) {
    throw new BackupError(
      `This backup is version ${envelope.version}, which this build does not know how to open.`,
      'unsupported_version'
    );
  }

  const key = await deriveKey(
    passphrase,
    fromBase64(envelope.kdf.salt),
    envelope.kdf.iterations ?? KDF_ITERATIONS
  );

  try {
    const plaintext = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: fromBase64(envelope.cipher.iv) },
      key,
      fromBase64(envelope.ciphertext)
    );
    return new TextDecoder().decode(plaintext);
  } catch {
    // GCM cannot tell a wrong passphrase from a tampered file, and neither can
    // we, so the message covers both without guessing.
    throw new BackupError(
      'That passphrase does not open this file. There is no recovery: if the passphrase is lost the backup cannot be read by anyone, including us.',
      'bad_passphrase'
    );
  }
}
