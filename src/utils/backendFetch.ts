/**
 * backendFetch — Authenticated fetch wrapper for the Apptivia Express backend.
 *
 * Automatically attaches the current Supabase session JWT as a Bearer token so
 * the backend auth middleware can verify every request.
 */

import { supabase } from '../supabaseClient';

const BACKEND_BASE = process.env.REACT_APP_BACKEND_URL || '';

async function getAuthHeaders(): Promise<Record<string, string>> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token) return {};
  return { Authorization: `Bearer ${session.access_token}` };
}

export async function backendFetch<T = any>(
  path: string,
  body?: Record<string, any>,
  method: string = 'POST',
): Promise<T> {
  if (!BACKEND_BASE) {
    throw new Error('No backend URL configured (REACT_APP_BACKEND_URL)');
  }

  const authHeaders = await getAuthHeaders();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...authHeaders,
  };

  const options: RequestInit = { method, headers };
  if (method !== 'GET' && body !== undefined) {
    options.body = JSON.stringify(body);
  }

  const res = await fetch(`${BACKEND_BASE}${path}`, options);
  const contentType = res.headers.get('content-type') || '';
  if (contentType.includes('text/html')) {
    throw new Error('Backend returned HTML instead of JSON — check REACT_APP_BACKEND_URL');
  }
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(text || `Backend returned ${res.status}`);
  }
  return res.json();
}

/**
 * backendStream — Authenticated streaming fetch for SSE endpoints.
 *
 * Calls the backend and returns an async generator that yields text
 * tokens as they arrive. The server must send SSE events in the format:
 *   data: {"text": "..."}\n\n   (token)
 *   data: {"done": true}\n\n   (end of stream)
 *   data: {"error": "..."}\n\n (server error)
 */
export async function* backendStream(
  path: string,
  body: Record<string, any>,
): AsyncGenerator<string, void, unknown> {
  if (!BACKEND_BASE) {
    throw new Error('No backend URL configured (REACT_APP_BACKEND_URL)');
  }

  const authHeaders = await getAuthHeaders();
  const res = await fetch(`${BACKEND_BASE}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeaders },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(text || `Backend returned ${res.status}`);
  }

  if (!res.body) throw new Error('No response body for streaming');

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() ?? '';

      for (const line of lines) {
        if (!line.startsWith('data: ')) continue;
        try {
          const payload = JSON.parse(line.slice(6));
          if (payload.error) throw new Error(payload.error);
          if (payload.done) return;
          if (payload.text) yield payload.text;
        } catch (parseErr) {
          if (parseErr instanceof Error && parseErr.message !== 'Unexpected end of JSON input') {
            throw parseErr;
          }
        }
      }
    }
  } finally {
    reader.releaseLock();
  }
}
