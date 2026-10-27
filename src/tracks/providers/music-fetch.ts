import { AsyncLocalStorage } from 'node:async_hooks';

const deadline = new AsyncLocalStorage<{ until: number; cache: boolean }>();
const recent = new Map<string, { expires: number; result: Promise<Response> }>();

export function withMusicDeadline<T>(action: () => Promise<T>, fresh = false): Promise<T> {
  return deadline.run({ until: Date.now() + 24_000, cache: !fresh }, action);
}

export async function musicFetch(url: string, init: RequestInit = {}): Promise<Response> {
  const context = deadline.getStore();
  const remaining = (context?.until ?? Date.now() + 4_000) - Date.now();
  if (remaining <= 0) return Promise.reject(new Error('Music matching deadline exceeded'));
  const timeout = AbortSignal.timeout(Math.min(4_000, remaining));
  const cached = context?.cache && (!init.method || init.method === 'GET');
  if (cached) {
    const entry = recent.get(url);
    if (entry && entry.expires > Date.now()) return (await entry.result).clone();
    recent.delete(url);
  }
  const result = fetch(url, {
    ...init,
    signal: init.signal ? AbortSignal.any([init.signal, timeout]) : timeout,
  });
  if (!cached) return result;
  if (recent.size >= 500) recent.delete(recent.keys().next().value!);
  const buffered = result
    .then(async (response) => {
      const body = await response.arrayBuffer();
      if (!response.ok || body.byteLength > 256 * 1024) recent.delete(url);
      return new Response(body, { status: response.status, headers: response.headers });
    })
    .catch((error: unknown) => {
      recent.delete(url);
      throw error;
    });
  recent.set(url, { expires: Date.now() + 60_000, result: buffered });
  return (await buffered).clone();
}
