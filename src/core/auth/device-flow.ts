/**
 * GitHub OAuth Device Flow.
 *
 * Chosen because it is the only OAuth flow that completes without a server:
 * no client secret, no redirect handler. The user types a code on github.com
 * and we poll for the token.
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

export async function requestDeviceCode(): Promise<DeviceCode> {
  const res = await fetch(`${GITHUB}/login/device/code`, {
    method: 'POST',
    headers: { accept: 'application/json', 'content-type': 'application/json' },
    body: JSON.stringify({ client_id: CLIENT_ID, scope: SCOPES })
  });
  if (!res.ok) throw new Error(`device code request failed: ${res.status}`);
  return res.json();
}

/**
 * Polls until the user authorizes or the code expires.
 * GitHub's `slow_down` means back off. Ignoring it gets the app rate-limited.
 */
export async function pollForToken(
  device: DeviceCode,
  signal?: AbortSignal
): Promise<string> {
  let interval = device.interval * 1000;
  const deadline = Date.now() + device.expires_in * 1000;

  while (Date.now() < deadline) {
    if (signal?.aborted) throw new Error('aborted');
    await new Promise((r) => setTimeout(r, interval));

    const res = await fetch(`${GITHUB}/login/oauth/access_token`, {
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
