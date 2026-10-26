/**
 * lib/api-client.ts (F7a): token rotation on 401 and ApiError.
 * - If the stored token already changed while the request was in flight (another request refreshed it),
 *   the request is retried with that token WITHOUT a second POST /api/auth/refresh.
 * - The retry always carries the fresh token, never the caller's (stale) Authorization header; the first
 *   attempt still respects a caller header.
 * - apiJson throws ApiError with .status / .data and the "Request failed with status code N" message.
 */

const g = globalThis as unknown as Record<string, unknown>;
const store = new Map<string, string>();
const localStorageFake = {
  getItem: (k: string) => store.get(k) ?? null,
  setItem: (k: string, v: string) => void store.set(k, v),
  removeItem: (k: string) => void store.delete(k),
};

const json = (status: number, body?: unknown) =>
  new Response(body === undefined ? null : JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

type Call = { url: string; init: RequestInit };
let calls: Call[];
let handler: (url: string, init: RequestInit) => Response | Promise<Response>;
const auth = (c: Call) => new Headers(c.init.headers).get('Authorization');
const refreshCalls = () => calls.filter((c) => c.url === '/api/auth/refresh');

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

import { ApiError, apiFetch, apiJson } from '../api-client';

describe('apiFetch token rotation', () => {
  it('retries with the token another request already stored, with no second refresh', async () => {
    store.set('authToken', 'OLD');
    handler = (url) => {
      if (url === '/api/data') {
        // the 401 for OLD arrives after a concurrent request rotated the stored token
        if (calls.filter((c) => c.url === '/api/data').length === 1) {
          store.set('authToken', 'NEW');
          return json(401, { error: 'expired' });
        }
        return json(200, { ok: true });
      }
      throw new Error(`unexpected ${url}`);
    };
    const res = await apiFetch('/api/data');
    expect(res.status).toBe(200);
    expect(refreshCalls()).toHaveLength(0);
    const data = calls.filter((c) => c.url === '/api/data');
    expect(data.map(auth)).toEqual(['Bearer OLD', 'Bearer NEW']);
  });

  it('refreshes once when the stored token did NOT change', async () => {
    store.set('authToken', 'OLD');
    handler = (url, init) => {
      if (url === '/api/auth/refresh') return json(200, { token: 'FRESH' });
      return new Headers(init.headers).get('Authorization') === 'Bearer FRESH' ? json(200, {}) : json(401, {});
    };
    expect((await apiFetch('/api/data')).status).toBe(200);
    expect(refreshCalls()).toHaveLength(1);
    expect(store.get('authToken')).toBe('FRESH');
  });

  it('never reuses a caller Authorization header on the retry (it is the stale one)', async () => {
    store.set('authToken', 'OLD');
    handler = (url, init) => {
      if (url === '/api/auth/refresh') return json(200, { token: 'FRESH' });
      return new Headers(init.headers).get('Authorization') === 'Bearer FRESH' ? json(200, {}) : json(401, {});
    };
    const res = await apiFetch('/api/data', { headers: { Authorization: 'Bearer CALLER-STALE' } });
    expect(res.status).toBe(200);
    const data = calls.filter((c) => c.url === '/api/data');
    expect(data.map(auth)).toEqual(['Bearer CALLER-STALE', 'Bearer FRESH']);
  });

  it('same for the rotated-token path: the caller header is replaced by the stored one', async () => {
    store.set('authToken', 'OLD');
    handler = (url) => {
      if (calls.filter((c) => c.url === url).length === 1) {
        store.set('authToken', 'NEW');
        return json(401, {});
      }
      return json(200, {});
    };
    await apiFetch('/api/data', { headers: { Authorization: 'Bearer CALLER-STALE' } });
    expect(calls.map(auth)).toEqual(['Bearer CALLER-STALE', 'Bearer NEW']);
    expect(refreshCalls()).toHaveLength(0);
  });
});

describe('apiJson / ApiError', () => {
  it('throws ApiError carrying status, parsed body and the server message', async () => {
    handler = () => json(409, { error: 'ALREADY_UNPROCESSED' });
    const err = (await apiJson('/api/x', { method: 'POST' }).catch((e) => e)) as ApiError;
    expect(err).toBeInstanceOf(ApiError);
    expect(err).toBeInstanceOf(Error);
    expect(err.status).toBe(409);
    expect(err.data).toEqual({ error: 'ALREADY_UNPROCESSED' });
    expect(err.message).toBe('Request failed with status code 409');
    expect(err.serverMessage).toBe('ALREADY_UNPROCESSED');
  });

  it('serverMessage falls back to the generic message when there is no { error } string', async () => {
    handler = () => json(500);
    const err = (await apiJson('/api/x').catch((e) => e)) as ApiError;
    expect(err.data).toBeUndefined();
    expect(err.serverMessage).toBe('Request failed with status code 500');
    expect(new ApiError(400, { error: 42 }).serverMessage).toBe('Request failed with status code 400');
    expect(new ApiError(400, null).serverMessage).toBe('Request failed with status code 400');
  });
});
