/**
 * lib/cisp.ts: CISP U-space list -> UPPS shape, and the URL setting.
 */

import { DEFAULT_CISP_USPACES_URL, getCispUspacesUrl, toUspaces } from '../cisp';

const ORIGINAL_URL = process.env.CISP_USPACES_URL;

afterEach(() => {
  if (ORIGINAL_URL === undefined) delete process.env.CISP_USPACES_URL;
  else process.env.CISP_USPACES_URL = ORIGINAL_URL;
});

const RING = [[-0.293824, 39.650306], [-0.232196, 39.650306], [-0.232196, 39.58758], [-0.293824, 39.58758], [-0.293824, 39.650306]];

// Same shape as the live CISP answer.
const feature = (over: Record<string, unknown> = {}) => ({
  type: 'Feature',
  bbox: [-0.293824, 39.58758, -0.232196, 39.650306],
  name: 'U-space Puerto de Sagunto',
  geometry: {
    type: 'Polygon',
    coordinates: [RING],
    verticalReference: { upper: 120.0, upperReference: 'AGL', lower: 0.0, lowerReference: 'AGL', uom: 'm' },
    subType: null,
    radius: 0.0,
  },
  properties: { identifier: 'PSGUspace' },
  ...over,
});

const payload = (...features: unknown[]) => ({
  updateTime: '2026-11-11T12:38:10.863015',
  uspaces: features,
  summary: { total: features.length, source: 'SNA_CISP' },
});

const withGeometry = (geometry: Record<string, unknown>) => feature({ geometry: { ...feature().geometry, ...geometry } });

describe('toUspaces', () => {
  it('maps a real CISP feature: id, name, boundary as latitude/longitude, closed ring kept', () => {
    const out = toUspaces(payload(feature()));
    expect(out).toHaveLength(1);
    const u = out![0];
    expect(u.id).toBe('PSGUspace');
    expect(u.name).toBe('U-space Puerto de Sagunto');
    expect(u.boundary).toHaveLength(5);
    expect(u.boundary[0]).toEqual({ latitude: 39.650306, longitude: -0.293824 });
    expect(u.boundary[2]).toEqual({ latitude: 39.58758, longitude: -0.232196 });
    expect(u.boundary[4]).toEqual(u.boundary[0]);
    expect(Object.keys(u).sort()).toEqual(['boundary', 'id', 'name']);
  });

  it('accepts radius null and AMSL references (ignored)', () => {
    const f = withGeometry({
      radius: null,
      verticalReference: { upper: 150, upperReference: 'AMSL', lower: 0, lowerReference: 'AMSL', uom: 'm' },
    });
    expect(toUspaces(payload(f))).toHaveLength(1);
  });

  it('falls back to the identifier when name is null, missing or empty', () => {
    const noName: Record<string, unknown> = feature();
    delete noName.name;
    const out = toUspaces(payload(
      feature({ name: null }),
      feature({ name: '', properties: { identifier: 'B' } }),
      { ...noName, properties: { identifier: 'C' } },
    ));
    expect(out!.map((u) => u.name)).toEqual(['PSGUspace', 'B', 'C']);
  });

  it('keeps the CISP order and skips only the bad features', () => {
    const out = toUspaces(payload(
      feature({ properties: { identifier: 'A' } }),
      feature({ properties: {} }),
      feature({ properties: { identifier: 'B' } }),
    ));
    expect(out!.map((u) => u.id)).toEqual(['A', 'B']);
  });

  it.each([
    ['no identifier', feature({ properties: {} })],
    ['empty identifier', feature({ properties: { identifier: '' } })],
    ['no properties', feature({ properties: undefined })],
    ['non-Polygon geometry', withGeometry({ type: 'MultiPolygon' })],
    ['Point geometry', withGeometry({ type: 'Point', coordinates: [0, 0] })],
    ['no rings', withGeometry({ coordinates: [] })],
    ['ring with fewer than 4 points', withGeometry({ coordinates: [RING.slice(0, 3)] })],
    ['longitude out of range', withGeometry({ coordinates: [[[200, 39], [1, 39], [1, 40], [200, 39]]] })],
    ['latitude out of range', withGeometry({ coordinates: [[[0, 95], [1, 39], [1, 40], [0, 95]]] })],
    ['non-numeric coordinate', withGeometry({ coordinates: [[[0, 'x'], [1, 39], [1, 40], [0, 39]]] })],
    ['null feature', null],
  ])('skips a feature with %s', (_label, f) => {
    expect(toUspaces(payload(f))).toEqual([]);
  });

  it('accepts 3D coordinates [lon, lat, alt] and drops the altitude', () => {
    const ring3d = RING.map(([lon, lat]) => [lon, lat, 0]);
    const out = toUspaces(payload(withGeometry({ coordinates: [ring3d] })));
    expect(out![0].boundary[1]).toEqual({ latitude: 39.650306, longitude: -0.232196 });
  });

  it('uses only the outer ring', () => {
    const hole = [[-0.27, 39.62], [-0.25, 39.62], [-0.25, 39.6], [-0.27, 39.6], [-0.27, 39.62]];
    const out = toUspaces(payload(withGeometry({ coordinates: [RING, hole] })));
    expect(out![0].boundary).toHaveLength(5);
  });

  it('returns an empty list for an empty CISP list', () => {
    expect(toUspaces({ uspaces: [] })).toEqual([]);
  });

  it.each([
    ['null', null],
    ['undefined', undefined],
    ['empty object', {}],
    ['uspaces as object', { uspaces: {} }],
    ['uspaces as string', { uspaces: 'x' }],
    ['array', []],
    ['array of features', [feature()]],
    ['string', 'uspaces'],
  ])('returns null for a non-list payload (%s)', (_label, data) => {
    expect(toUspaces(data)).toBeNull();
  });
});

describe('getCispUspacesUrl', () => {
  it('defaults to the SNA CISP', () => {
    delete process.env.CISP_USPACES_URL;
    expect(getCispUspacesUrl()).toBe('http://sna-server.upvnet.upv.es:8000/spirit_cisp/uspaces');
    expect(getCispUspacesUrl()).toBe(DEFAULT_CISP_USPACES_URL);
  });

  it('treats an empty value like an unset one', () => {
    process.env.CISP_USPACES_URL = '';
    expect(getCispUspacesUrl()).toBe(DEFAULT_CISP_USPACES_URL);
  });

  it('honours CISP_USPACES_URL', () => {
    process.env.CISP_USPACES_URL = 'http://cisp.test/uspaces';
    expect(getCispUspacesUrl()).toBe('http://cisp.test/uspaces');
  });
});
