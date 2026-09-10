/**
 * Reading and writing JSON documents in the data repo.
 * A write is a commit; the audit log is `git log`.
 */

import { ghFetch } from './client';

const DATA_REPO = import.meta.env.PUBLIC_DATA_REPO ?? 'pointbreaklab-hub/pointbreak-data';

interface ContentsResponse {
  content: string;
  sha: string;
  encoding: 'base64';
}

function decode(base64: string): string {
  return new TextDecoder().decode(Uint8Array.from(atob(base64), (c) => c.charCodeAt(0)));
}

function encode(text: string): string {
  return btoa(String.fromCharCode(...new TextEncoder().encode(text)));
}

export async function readJSON<T>(path: string): Promise<{ data: T; sha: string }> {
  const res = await ghFetch<ContentsResponse>(`/repos/${DATA_REPO}/contents/${path}`);
  return { data: JSON.parse(decode(res.content)) as T, sha: res.sha };
}

export async function listDir(path: string): Promise<Array<{ name: string; path: string }>> {
  return ghFetch(`/repos/${DATA_REPO}/contents/${path}`);
}

/**
 * `sha` is required when replacing an existing file. Omitting it on an update
 * is how you get a 409 — pass the sha from the read that produced your edit.
 */
export async function writeJSON(
  path: string,
  data: unknown,
  message: string,
  sha?: string
): Promise<void> {
  await ghFetch(`/repos/${DATA_REPO}/contents/${path}`, {
    method: 'PUT',
    body: JSON.stringify({
      message,
      content: encode(JSON.stringify(data, null, 2) + '\n'),
      sha
    })
  });
}
