/**
 * GitHub OAuth Device Flow.
 *
 * UNUSABLE FROM A BROWSER. Kept for reference and for the day a proxy exists.
 *
 * Device Flow was chosen because it needs no client secret, which is true and
 * was the right instinct for a static site. It does not solve the other half of
 * the problem: `github.com/login/device/code` and
 * `github.com/login/oauth/access_token` send no Access-Control-Allow-Origin
 * header, so a browser refuses the request before it leaves. The symptom is a
 * bare "Failed to fetch" with no detail, because that is all CORS tells you.
 *
 * Verify for yourself:
 *
 *   curl -si -X POST https://github.com/login/device/code \
 *     -H 'Origin: https://example.com' | grep -i access-control
 *
 * Nothing comes back. `api.github.com` does send the header, which is why every
 * other call in this app works.
 *
 * So completing Device Flow requires something server-side to relay the two
 * token calls. Until that exists, auth uses a personal access token the user
 * pastes, which needs no relay because it never touches github.com/login.
 */

const GITHUB = 'https://github.com';
const CLIENT_ID = import.meta.env.PUBLIC_GITHUB_CLIENT_ID ?? '';
const SCOPES = 'public_repo read:user';

export interface DeviceCode {
  device_code: string;
  user_code: string;
  verification_uri: string;
  expires_in: number;
  interval: number;
}

/** Requires a CORS-relaying proxy. See the note above. */
export async function requestDeviceCode(relay: string): Promise<DeviceCode> {
  const res = await fetch(`${relay}${GITHUB}/login/device/code`, {
    method: 'POST',
    headers: { accept: 'application/json', 'content-type': 'application/json' },
    body: JSON.stringify({ client_id: CLIENT_ID, scope: SCOPES })
  });
  if (!res.ok) throw new Error(`device code request failed: ${res.status}`);
  return res.json();
}

/** Requires the same relay. GitHub's `slow_down` means back off. */
export async function pollForToken(
  device: DeviceCode,
  relay: string,
  signal?: AbortSignal
): Promise<string> {
  let interval = device.interval * 1000;
  const deadline = Date.now() + device.expires_in * 1000;

  while (Date.now() < deadline) {
    if (signal?.aborted) throw new Error('aborted');
    await new Promise((r) => setTimeout(r, interval));

    const res = await fetch(`${relay}${GITHUB}/login/oauth/access_token`, {
      method: 'POST',
      headers: { accept: 'application/json', 'content-type': 'application/json' },
      body: JSON.stringify({
        client_id: CLIENT_ID,
        device_code: device.device_code,
        grant_type: 'urn:ietf:params:oauth:grant-type:device_code'
      })
    });
    const body = await res.json();

    if (body.access_token) return body.access_token as string;
    if (body.error === 'slow_down') interval += 5000;
    else if (body.error !== 'authorization_pending') {
      throw new Error(body.error_description ?? body.error ?? 'authorization failed');
    }
  }

  throw new Error('device code expired');
}
