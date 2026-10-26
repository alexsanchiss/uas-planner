/**
 * lib/fas.ts: the single FAS client (E4 outbound contract).
 *
 * Pins what must stay byte-identical to the historical per-route copies (default base URL,
 * origin-only base, cancellation URL/method, no extra headers/body) and the only addition:
 * a 30 s timeout signal whose expiry never throws out of the cancellation helper.
 */

import { FAS_TIMEOUT_MS, fasFetch, getFasApiUrl, getFasBaseUrl, sendFasCancellation } from '../fas';

const ORIGINAL_FAS_API_URL = process.env.FAS_API_URL;

const fetchMock = jest.fn();
const originalFetch = global.fetch;

// What an expired AbortSignal.timeout() rejects with (a plain Error here: jest's VM realm
// does not see the outer realm's DOMException as `instanceof Error`).
const timeoutError = () => Object.assign(new Error('The operation was aborted due to timeout'), { name: 'TimeoutError' });

beforeEach(() => {
  fetchMock.mockReset();
  jest.restoreAllMocks();
  global.fetch = fetchMock as unknown as typeof fetch;
  delete process.env.FAS_API_URL;
});

afterAll(() => {
  global.fetch = originalFetch;
  if (ORIGINAL_FAS_API_URL === undefined) delete process.env.FAS_API_URL;
  else process.env.FAS_API_URL = ORIGINAL_FAS_API_URL;
});

describe('getFasApiUrl / getFasBaseUrl (E4 URLs)', () => {
  it('defaults to the historical production URL, byte for byte', () => {
    expect(getFasApiUrl()).toBe('http://158.42.167.56:8000/uplan');
    expect(getFasBaseUrl()).toBe('http://158.42.167.56:8000');
  });

  it('treats an empty FAS_API_URL like an unset one (same as the old `||` default)', () => {
    process.env.FAS_API_URL = '';
    expect(getFasApiUrl()).toBe('http://158.42.167.56:8000/uplan');
  });

  it('reads the env lazily, so a value set after import is honoured', () => {
    process.env.FAS_API_URL = 'http://fas.test:9000/uplan';
    expect(getFasApiUrl()).toBe('http://fas.test:9000/uplan');
    process.env.FAS_API_URL = 'http://other.test:1234/uplan';
    expect(getFasBaseUrl()).toBe('http://other.test:1234');
  });

  it('keeps only protocol + host of the configured URL and discards the path', () => {
    process.env.FAS_API_URL = 'https://fas.example.org:8443/some/deep/path/uplan/';
    expect(getFasBaseUrl()).toBe('https://fas.example.org:8443');
  });

  it('falls back to stripping a trailing /uplan when the value is not a valid URL', () => {
    process.env.FAS_API_URL = 'not a url/uplan';
    expect(getFasBaseUrl()).toBe('not a url');
    process.env.FAS_API_URL = 'not a url/uplan/';
    expect(getFasBaseUrl()).toBe('not a url');
  });
});

describe('fasFetch', () => {
  it('is a 30 s timeout', () => {
    expect(FAS_TIMEOUT_MS).toBe(30_000);
  });

  it('passes URL, method, headers and body through untouched and only adds a timeout signal', async () => {
    fetchMock.mockResolvedValue(new Response('ok'));
    const timeoutSpy = jest.spyOn(AbortSignal, 'timeout');
    const init = { method: 'POST', headers: { 'X-Test': '1' }, body: '{"a":1}' };

    await fasFetch('http://fas.test/x', init);

    expect(timeoutSpy).toHaveBeenCalledWith(30_000);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, sent] = fetchMock.mock.calls[0];
    expect(url).toBe('http://fas.test/x');
    expect(Object.keys(sent).sort()).toEqual(['body', 'headers', 'method', 'signal']);
    expect(sent).toMatchObject(init);
    expect(sent.signal).toBeInstanceOf(AbortSignal);
    expect((sent.signal as AbortSignal).aborted).toBe(false);
    // the caller's init object is not mutated
    expect(init).toEqual({ method: 'POST', headers: { 'X-Test': '1' }, body: '{"a":1}' });
  });

  it('without init sends only { signal }', async () => {
    fetchMock.mockResolvedValue(new Response('ok'));
    await fasFetch('http://fas.test/y');
    expect(Object.keys(fetchMock.mock.calls[0][1])).toEqual(['signal']);
  });

  it('propagates the timeout as a rejection so the callers keep their existing network-error path', async () => {
    jest.spyOn(AbortSignal, 'timeout').mockReturnValue(AbortSignal.abort(timeoutError()));
    fetchMock.mockImplementation((_url: string, init: RequestInit) =>
      init.signal?.aborted ? Promise.reject(init.signal.reason) : Promise.resolve(new Response('late')),
    );

    await expect(fasFetch('http://fas.test/slow')).rejects.toMatchObject({ name: 'TimeoutError' });
  });
});

describe('sendFasCancellation (E4: DELETE {origin}/uplan_cancelation/{enc(n)})', () => {
  beforeEach(() => {
    jest.spyOn(console, 'warn').mockImplementation(() => {});
  });

  it('sends exactly DELETE to the origin-only cancellation URL, url-encoding the number, with no headers or body', async () => {
    process.env.FAS_API_URL = 'http://fas.test:8000/uplan';
    fetchMock.mockResolvedValue(new Response(null, { status: 200 }));

    await expect(sendFasCancellation('EXT/1 x?')).resolves.toBeUndefined();

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('http://fas.test:8000/uplan_cancelation/EXT%2F1%20x%3F');
    expect(Object.keys(init).sort()).toEqual(['method', 'signal']);
    expect(init.method).toBe('DELETE');
    expect(init.signal).toBeInstanceOf(AbortSignal);
  });

  it('uses the default production origin when FAS_API_URL is unset', async () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 200 }));
    await sendFasCancellation('42');
    expect(fetchMock.mock.calls[0][0]).toBe('http://158.42.167.56:8000/uplan_cancelation/42');
  });

  it('logs a warning and still resolves on a non-OK FAS response', async () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 404, statusText: 'Not Found' }));

    await expect(sendFasCancellation('EXT-9')).resolves.toBeUndefined();

    expect(console.warn).toHaveBeenCalledWith(expect.stringContaining('EXT-9: 404 Not Found'));
  });

  it('logs and resolves on a network error', async () => {
    fetchMock.mockRejectedValue(new Error('ECONNREFUSED'));

    await expect(sendFasCancellation('EXT-9')).resolves.toBeUndefined();

    expect(console.warn).toHaveBeenCalledWith(expect.stringContaining('Failed to cancel EXT-9'), 'ECONNREFUSED');
  });

  it('logs and resolves when the 30 s timeout fires: a hung FAS never blocks or fails the caller', async () => {
    jest.spyOn(AbortSignal, 'timeout').mockReturnValue(AbortSignal.abort(timeoutError()));
    fetchMock.mockImplementation((_url: string, init: RequestInit) =>
      init.signal?.aborted ? Promise.reject(init.signal.reason) : new Promise(() => {}),
    );

    await expect(sendFasCancellation('EXT-9')).resolves.toBeUndefined();

    expect(console.warn).toHaveBeenCalledWith(expect.stringContaining('Failed to cancel EXT-9'), expect.stringMatching(/time/i));
  });
});
