/**
 * Pseudonymous application identity.
 *
 * The public ledger must never carry a GitHub login. Job searching is
 * confidential, and a public append-only log of "who applied where" is a
 * permanent record your current employer can read.
 *
 * A hash of the login is not good enough. The login space is small and
 * enumerable, so anyone could compute the hash for a specific person and test
 * whether they applied somewhere. The ref is therefore random, and the mapping
 * back to a person exists only in that person's own browser.
 */

import type { ApplicationRef } from './types';

/** 128 bits of randomness. Collisions are not a practical concern. */
export function mintApplicationRef(): ApplicationRef {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  return 'app_' + [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('');
}

export function isApplicationRef(value: string): boolean {
  return /^app_[0-9a-f]{32}$/.test(value);
}

export async function sha256Hex(text: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

/** Stable hash of a job description, used to detect reposts without refetching. */
export async function descriptionHash(description: string): Promise<string> {
  const normalized = description.toLowerCase().replace(/\s+/g, ' ').trim();
  return `sha256:${(await sha256Hex(normalized)).slice(0, 32)}`;
}

const TRACKING_PARAMS = /^(utm_|gclid|fbclid|ref|source|trk|trackingId|refId|position|pageNum)/i;

/**
 * Canonical form of a posting URL, so the same job logged by ten people from
 * ten differently-decorated links collapses into one record.
 */
export function normalizeJobUrl(raw: string): string {
  const url = new URL(raw.trim());

  url.hash = '';
  url.hostname = url.hostname.toLowerCase().replace(/^www\./, '');
  url.protocol = 'https:';

  for (const key of [...url.searchParams.keys()]) {
    if (TRACKING_PARAMS.test(key)) url.searchParams.delete(key);
  }

  // LinkedIn encodes the job id in the path or in currentJobId; keep only that.
  if (url.hostname.endsWith('linkedin.com')) {
    const id = url.pathname.match(/\/jobs\/view\/(\d+)/)?.[1] ?? url.searchParams.get('currentJobId');
    if (id) return `https://linkedin.com/jobs/view/${id}`;
  }

  url.pathname = url.pathname.replace(/\/+$/, '');
  return url.toString();
}

export async function jobSourceHash(rawUrl: string): Promise<string> {
  return `sha256:${(await sha256Hex(normalizeJobUrl(rawUrl))).slice(0, 32)}`;
}

/** Subdomains a company puts its careers site on. Not part of its identity. */
const JOB_SUBDOMAINS = new Set([
  'www',
  'careers',
  'career',
  'jobs',
  'job',
  'apply',
  'hire',
  'hiring',
  'work',
  'talent',
  'recruiting',
  'recruitment'
]);

/** Second-level suffixes that are part of the TLD, not the company name. */
const MULTIPART_TLDS = new Set(['co', 'com', 'net', 'org', 'gov', 'ac', 'edu']);

/**
 * Company slug from a posting URL, used when no GitHub org is known.
 *
 * This is an identity function, so over-splitting is the expensive failure:
 * acme.com and careers.acme.com resolving differently would give one company
 * two Ghost Scores and let it hide behind whichever looked better.
 */
export function companyIdFromUrl(raw: string): string {
  const url = new URL(raw);
  const host = url.hostname.toLowerCase();

  // Applicant tracking systems host thousands of companies, so the board slug
  // is the real identity and the ATS domain is noise.
  const ats = /^(boards|jobs|job-boards)\.(greenhouse|lever|ashbyhq|workable|smartrecruiters)\.(io|co|com)$/;
  if (ats.test(host)) {
    const slug = url.pathname.split('/').filter(Boolean)[0];
    if (slug) return slug.toLowerCase();
  }

  const labels = host.split('.');

  // Drop the TLD, allowing for co.uk, com.au and friends.
  if (labels.length > 2 && MULTIPART_TLDS.has(labels[labels.length - 2])) labels.splice(-2);
  else labels.splice(-1);

  while (labels.length > 1 && JOB_SUBDOMAINS.has(labels[0])) labels.shift();

  return labels.join('-') || host;
}
