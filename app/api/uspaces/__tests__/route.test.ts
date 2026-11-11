/**
 * GET /api/uspaces: relay of the CISP U-space list. Only fetch is faked.
 */

import { GET } from '../route';

const ORIGINAL_URL = process.env.CISP_USPACES_URL;
const fetchMock = jest.fn();
const originalFetch = global.fetch;

// What an expired AbortSignal.timeout() rejects with (a plain Error here: the jest VM realm).
const timeoutError = () => Object.assign(new Error('The operation was aborted due to timeout'), { name: 'TimeoutError' });

const cispBody = {
  updateTime: '2026-11-11T12:38:10.863015',
  uspaces: [
    {
      type: 'Feature',
      name: 'U-space Puerto de Sagunto',
      geometry: {
        type: 'Polygon',
        coordinates: [[[-0.293824, 39.650306], [-0.232196, 39.650306], [-0.232196, 39.58758], [-0.293824, 39.58758], [-0.293824, 39.650306]]],
        radius: null,
      },
      properties: { identifier: 'PSGUspace' },
    },
    { type: 'Feature', name: 'broken', geometry: { type: 'Point', coordinates: [0, 0] }, properties: { identifier: 'BAD' } },
  ],
  summary: { total: 2, source: 'SNA_CISP' },
};

const ok = (body: unknown) => ({ ok: true, status: 200, json: async () => body });

beforeEach(() => {
  fetchMock.mockReset();
  jest.spyOn(console, 'error').mockImplementation(() => {});
  global.fetch = fetchMock as unknown as typeof fetch;
  delete process.env.CISP_USPACES_URL;
});

afterAll(() => {
  jest.restoreAllMocks();
  global.fetch = originalFetch;
  if (ORIGINAL_URL === undefined) delete process.env.CISP_USPACES_URL;
  else process.env.CISP_USPACES_URL = ORIGINAL_URL;
});

describe('GET /api/uspaces', () => {
  it('200: mapped U-spaces and count (bad features left out)', async () => {
    fetchMock.mockResolvedValue(ok(cispBody));
    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.count).toBe(1);
    expect(body.uspaces).toHaveLength(1);
    expect(body.uspaces[0]).toMatchObject({ id: 'PSGUspace', name: 'U-space Puerto de Sagunto' });
    expect(body.uspaces[0].boundary[0]).toEqual({ latitude: 39.650306, longitude: -0.293824 });
  });

  it('200 with an empty list when the CISP has no U-spaces', async () => {
    fetchMock.mockResolvedValue(ok({ uspaces: [] }));
    const res = await GET();
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ success: true, uspaces: [], count: 0 });
  });

  it('fetches the default CISP URL, GET, no body, with a timeout signal and no cache', async () => {
    fetchMock.mockResolvedValue(ok(cispBody));
    await GET();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('http://sna-server.upvnet.upv.es:8000/spirit_cisp/uspaces');
    expect(init.method).toBeUndefined();
    expect(init.body).toBeUndefined();
    expect(init.cache).toBe('no-store');
    expect(init.signal).toBeInstanceOf(AbortSignal);
  });

  it('fetches CISP_USPACES_URL when configured', async () => {
    process.env.CISP_USPACES_URL = 'http://cisp.test:9000/uspaces';
    fetchMock.mockResolvedValue(ok(cispBody));
    await GET();
    expect(fetchMock.mock.calls[0][0]).toBe('http://cisp.test:9000/uspaces');
  });

  it('503 when the CISP is unreachable', async () => {
    fetchMock.mockRejectedValue(new TypeError('fetch failed'));
    const res = await GET();
    expect(res.status).toBe(503);
    expect((await res.json()).error).toMatch(/unavailable/);
  });

  it('504 on timeout', async () => {
    fetchMock.mockRejectedValue(timeoutError());
    const res = await GET();
    expect(res.status).toBe(504);
    expect((await res.json()).error).toMatch(/timeout/);
  });

  it('502 when the CISP answers non-2xx, without reading its body', async () => {
    const json = jest.fn();
    fetchMock.mockResolvedValue({ ok: false, status: 500, json });
    const res = await GET();
    expect(res.status).toBe(502);
    expect((await res.json()).error).toMatch(/500/);
    expect(json).not.toHaveBeenCalled();
  });

  it('502 on invalid JSON', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => {
        throw new SyntaxError('Unexpected token');
      },
    });
    const res = await GET();
    expect(res.status).toBe(502);
    expect((await res.json()).success).toBeUndefined();
  });

  it.each([
    ['object without uspaces', {}],
    ['uspaces not a list', { uspaces: {} }],
    ['bare array', []],
    ['null', null],
  ])('502 on a wrong shape (%s)', async (_label, body) => {
    fetchMock.mockResolvedValue(ok(body));
    const res = await GET();
    expect(res.status).toBe(502);
    expect((await res.json()).error).toMatch(/Invalid answer/);
  });
});
