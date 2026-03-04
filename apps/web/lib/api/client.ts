import { getAccessToken } from '../auth/session';

export const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL?.replace(/\/$/, '') ?? 'http://localhost:4000';

export async function apiRequest<T>(
  path: string,
  options: RequestInit & { authenticated?: boolean; idempotency?: boolean } = {},
): Promise<T> {
  const headers = new Headers(options.headers);
  headers.set('content-type', 'application/json');

  if (options.authenticated) {
    const token = getAccessToken();
    if (token) {
      headers.set('authorization', `Bearer ${token}`);
    }
  }

  if (options.idempotency) {
    headers.set('idempotency-key', crypto.randomUUID());
  }

  const res = await fetch(`${API_BASE_URL}/api${path}`, {
    ...options,
    headers,
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `Request failed with ${res.status}`);
  }

  return (await res.json()) as T;
}
