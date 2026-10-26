/**
 * lib/api-client.ts: the browser fetch wrapper adopted by app/hooks/**.
 * Contract: Bearer header from localStorage, ONE refresh on 401 shared by concurrent callers, ONE retry,
 * and the original 401 (body intact) when there is nothing to refresh with. Runs in the node env with a
 * fake window/localStorage and a scripted fetch.
 */

const g = globalThis as unknown as Record<string, unknown>;
const store = new Map<string, string>();
const localStorageFake = {
  getItem: (k: string) => store.get(k) ?? null,
  setItem: (k: string, v: string) => void store.set(k, v),
  removeItem: (k: string) => void store.delete(k),
};

const json = (status: number, body?: unknown) =>
  new Response(body === undefined ? null : JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });

type Call = { url: string; init: RequestInit };
let calls: Call[];
let handler: (url: string, init: RequestInit) => Response | Promise<Response>;
const auth = (c: Call) => new Headers(c.init.headers).get('Authorization');

beforeEach(() => {
  store.clear();
  calls = [];
  g.window = {};
  g.localStorage = localStorageFake;
  g.fetch = jest.fn(async (url: string, init: RequestInit = {}) => {
    calls.push({ url: String(url), init });
    return handler(String(url), init);
  });
  jest.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  jest.restoreAllMocks();
  delete g.window;
  delete g.localStorage;
});

import { apiFetch, apiJson, refreshAccessToken } from '../api-client';

describe('apiFetch', () => {
  it('sends the stored token as Bearer and JSON content type for string bodies', async () => {
    store.set('authToken', 'T1');
    handler = () => json(200, { ok: true });

    await apiFetch('/api/x', { method: 'POST', body: '{"a":1}' });

    expect(auth(calls[0])).toBe('Bearer T1');
    expect(new Headers(calls[0].init.headers).get('Content-Type')).toBe('application/json');
  });

  it('does not override an Authorization header the caller set', async () => {
    store.set('authToken', 'T1');
    handler = () => json(200, {});

    await apiFetch('/api/x', { headers: { Authorization: 'Bearer MINE' } });

    expect(auth(calls[0])).toBe('Bearer MINE');
  });

  it('on 401 refreshes ONCE, stores the new token and retries ONCE with it', async () => {
    store.set('authToken', 'OLD');
    handler = (url, init) => {
      if (url === '/api/auth/refresh') return json(200, { token: 'NEW' });
      return new Headers(init.headers).get('Authorization') === 'Bearer NEW' ? json(200, { n: 1 }) : json(401, { error: 'expired' });
    };

    const res = await apiFetch('/api/x');

    expect(res.status).toBe(200);
    expect(calls.map((c) => c.url)).toEqual(['/api/x', '/api/auth/refresh', '/api/x']);
    expect(calls[1].init).toMatchObject({ method: 'POST', credentials: 'include' });
    expect(auth(calls[2])).toBe('Bearer NEW');
    expect(store.get('authToken')).toBe('NEW');
  });

  it('cannot loop: a second 401 after the retry is returned as is, with no second refresh', async () => {
    store.set('authToken', 'OLD');
    handler = (url) => (url === '/api/auth/refresh' ? json(200, { token: 'NEW' }) : json(401, { error: 'still no' }));

    const res = await apiFetch('/api/x');

    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: 'still no' });
    expect(calls.filter((c) => c.url === '/api/auth/refresh')).toHaveLength(1);
    expect(calls).toHaveLength(3);
  });

  it('does not refresh without a stored token: the 401 and its body go back untouched', async () => {
    handler = () => json(401, { error: 'Unauthorized' });

    const res = await apiFetch('/api/x');

    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: 'Unauthorized' });
    expect(calls).toHaveLength(1);
    expect(auth(calls[0])).toBeNull();
  });

  it('returns the ORIGINAL 401 (message intact) when the refresh fails', async () => {
    store.set('authToken', 'OLD');
    handler = (url) => (url === '/api/auth/refresh' ? json(401, { error: 'no cookie' }) : json(401, { error: 'Token expired' }));

    const res = await apiFetch('/api/x');

    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: 'Token expired' });
    expect(store.get('authToken')).toBe('OLD');
    expect(calls).toHaveLength(2);
  });

  it('shares one refresh request between concurrent 401s', async () => {
    store.set('authToken', 'OLD');
    let release!: () => void;
    const gate = new Promise<void>((r) => (release = r));
    handler = async (url, init) => {
      if (url === '/api/auth/refresh') {
        await gate;
        return json(200, { token: 'NEW' });
      }
      return new Headers(init.headers).get('Authorization') === 'Bearer NEW' ? json(200, {}) : json(401, {});
    };

    const all = Promise.all([apiFetch('/api/a'), apiFetch('/api/b'), apiFetch('/api/c')]);
    await new Promise((r) => setTimeout(r, 10));
    release();
    const results = await all;

    expect(results.map((r) => r.status)).toEqual([200, 200, 200]);
    expect(calls.filter((c) => c.url === '/api/auth/refresh')).toHaveLength(1);
  });
});

describe('refreshAccessToken', () => {
  it('returns null (and keeps the old token) on a network error, and can be retried afterwards', async () => {
    store.set('authToken', 'OLD');
    handler = () => {
      throw new Error('offline');
    };
    expect(await refreshAccessToken()).toBeNull();
    expect(store.get('authToken')).toBe('OLD');

    handler = () => json(200, { token: 'NEW' });
    expect(await refreshAccessToken()).toBe('NEW');
  });
});

describe('apiJson', () => {
  it('serialises the body, parses the JSON answer', async () => {
    handler = () => json(200, { id: 7 });

    const out = await apiJson<{ id: number }>('/api/x', { method: 'POST', body: { a: 1 } });

    expect(out).toEqual({ id: 7 });
    expect(calls[0].init.body).toBe('{"a":1}');
    expect(new Headers(calls[0].init.headers).get('Content-Type')).toBe('application/json');
  });

  it('throws the axios-style message the UI already shows on a non-2xx', async () => {
    handler = () => json(500, { error: 'boom' });
    await expect(apiJson('/api/x')).rejects.toThrow('Request failed with status code 500');
  });

  it('gives undefined for an empty body (204)', async () => {
    handler = () => new Response(null, { status: 204 });
    await expect(apiJson('/api/x', { method: 'DELETE' })).resolves.toBeUndefined();
  });
});
