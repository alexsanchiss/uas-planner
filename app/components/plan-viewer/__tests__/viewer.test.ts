/**
 * Plan viewer (F13) pure parts shared by the 2D and 3D maps: the layers each preset switches on, the volume / zone styling
 * rules, the 4D clock, and the text of a clicked / hovered feature. The point of the last one: every altitude the user
 * sees (2D tooltip, 3D info card, legend) states its reference.
 */

import { getTranslation } from '@/app/i18n/translations'
import { buildPlanViewModel, type PlanViewInput, type PlanViewModel } from '@/lib/plan-view-model'
import { describeFeature, featureId, listFeatures } from '../featureInfo'
import { clock, initialLayers, isActive, LAYER_IDS, volumeColor, volumeState, zoneColor, zoneShown, type Layers, type Palette } from '../viewerStyle'

// featureInfo imports the i18n barrel (a .tsx context provider that the node environment cannot compile): only `interpolate` is needed
jest.mock('@/app/i18n', () => ({ interpolate: jest.requireActual('@/app/i18n/interpolate').interpolate }))

const en = getTranslation('en').planAuth.viewer
const es = getTranslation('es').planAuth.viewer

const ALL: Layers = { waypoints: true, trajectory: true, volumes: true, zones: true, result: true, scrs: true }
const NONE: Layers = { waypoints: false, trajectory: false, volumes: false, zones: false, result: false, scrs: false }

describe('initialLayers (what each tile opens)', () => {
  it('route: waypoints + trajectory; uplan: volumes; result: volumes + verdict + alternative', () => {
    expect(initialLayers('route', ALL)).toEqual({ ...NONE, waypoints: true, trajectory: true })
    expect(initialLayers('uplan', ALL)).toEqual({ ...NONE, volumes: true })
    expect(initialLayers('result', ALL)).toEqual({ ...NONE, volumes: true, result: true, scrs: true })
  })

  it('only the layers the plan has data for are switched on (an unprocessed plan: just its waypoints)', () => {
    const only = { ...NONE, waypoints: true }
    expect(initialLayers('route', only)).toEqual({ ...NONE, waypoints: true })
    expect(initialLayers('uplan', only)).toEqual(NONE)
    expect(initialLayers('result', { ...NONE, volumes: true, result: true })).toEqual({ ...NONE, volumes: true, result: true })
  })

  it('geozones are never on at open: they are a layer the user turns on', () => {
    for (const preset of ['route', 'uplan', 'result'] as const) expect(initialLayers(preset, ALL).zones).toBe(false)
  })

  it('LAYER_IDS lists exactly the chips', () => {
    expect([...LAYER_IDS].sort()).toEqual(Object.keys(ALL).sort())
  })
})

describe('styling rules', () => {
  const P: Palette = { info: 'i', success: 's', danger: 'd', warning: 'w', accent: 'a', muted: 'm' }
  const model = (status: 'approved' | 'denied' | null, message: unknown = null): PlanViewModel =>
    buildPlanViewModel({
      waypoints: [],
      uplan: { operationVolumes: [0, 1].map((o) => ({ ordinal: o, geometry: { type: 'Polygon', coordinates: [[[0, 0], [1, 0], [1, 1], [0, 1]]] }, minAltitude: { value: 0, reference: 'AGL' }, maxAltitude: { value: 10, reference: 'AGL' } })) },
      csv: null,
      authorizationMessage: message,
      authStatus: status,
      geoawarenessData: null,
      liveZones: [],
      uspaceId: null,
    } satisfies PlanViewInput)

  it('volumeState: the verdict only shows with the Result layer on', () => {
    const denied = model('denied', JSON.stringify({ volumes: [{ ordinal: 1, status: 'CONFLICTING' }] }))
    const [v0, v1] = denied.volumes
    expect([volumeState(denied, v0, ALL), volumeState(denied, v1, ALL)]).toEqual(['ok', 'conflicting'])
    expect([volumeState(denied, v0, { ...ALL, result: false }), volumeState(denied, v1, { ...ALL, result: false })]).toEqual(['ok', 'ok'])
    const approved = model('approved')
    expect(volumeState(approved, approved.volumes[0], ALL)).toBe('authorized')
    const plain = model(null)
    expect(volumeState(plain, plain.volumes[0], ALL)).toBe('ok')
  })

  it('colours: authorised green, conflicting red, the rest info', () => {
    expect([volumeColor('authorized', P), volumeColor('conflicting', P), volumeColor('ok', P)]).toEqual(['s', 'd', 'i'])
    expect([zoneColor('PROHIBITED', P), zoneColor('req_authorization', P), zoneColor('CONDITIONAL', P), zoneColor('', P), zoneColor('X', P)]).toEqual(['d', 'w', 'a', 'm', 'm'])
  })

  it('isActive: lit only inside its time window; no time or no window = lit', () => {
    const v = { beginMs: 1000, endMs: 2000 }
    expect([isActive(v, 999), isActive(v, 1000), isActive(v, 1500), isActive(v, 2000), isActive(v, 2001)]).toEqual([false, true, true, true, false])
    expect(isActive(v, null)).toBe(true)
    expect(isActive({ beginMs: null, endMs: null }, 5)).toBe(true)
  })

  it('zoneShown: the Geozones layer shows all, the Result layer only the conflicting ones', () => {
    expect(zoneShown({ conflicting: false }, { ...NONE, zones: true })).toBe(true)
    expect(zoneShown({ conflicting: false }, { ...NONE, result: true })).toBe(false)
    expect(zoneShown({ conflicting: true }, { ...NONE, result: true })).toBe(true)
    expect(zoneShown({ conflicting: true }, NONE)).toBe(false)
  })

  it('clock: m:ss and h:mm:ss, never negative', () => {
    expect([clock(0), clock(65_000), clock(3_600_000), clock(3_725_000), clock(-5000)]).toEqual(['0:00', '1:05', '1:00:00', '1:02:05', '0:00'])
  })
})

describe('describeFeature: altitudes always state their reference', () => {
  const zone = (id: string, vertical: object) => ({
    uas_geozones_identifier: id,
    properties: { name: `zone ${id}`, type: 'PROHIBITED' },
    geometry: { type: 'Polygon', coordinates: [[[-0.45, 39.7], [-0.44, 39.7], [-0.44, 39.71], [-0.45, 39.71]]], verticalReference: vertical },
  })
  const model = buildPlanViewModel({
    waypoints: [{ lat: 39.7, lng: -0.45, alt: 30 }, { lat: 39.701, lng: -0.449, alt: 30 }, { lat: 39.702, lng: -0.448, alt: 0 }],
    uplan: {
      operationVolumes: [
        { ordinal: 0, name: 'seg 1', geometry: { type: 'Polygon', coordinates: [[[-0.45, 39.7], [-0.449, 39.7], [-0.449, 39.701], [-0.45, 39.701]]] }, minAltitude: { value: 10, reference: 'AGL', uom: 'M' }, maxAltitude: { value: 400, reference: 'AGL', uom: 'FT' } },
      ],
    },
    csv: null,
    authorizationMessage: null,
    authStatus: null,
    geoawarenessData: null,
    liveZones: [zone('A', { lower: 0, upper: 120, lowerReference: 'AGL', upperReference: 'AGL', uom: 'M' }), zone('B', { lower: 100, upper: 300, lowerReference: 'AMSL', upperReference: 'AMSL', uom: 'M' }), zone('C', { lower: 0, upper: 300, lowerReference: 'AGL', upperReference: 'AMSL', uom: 'M' })],
    uspaceId: 'VLCUspace',
  })

  it('a waypoint: "30 m above takeoff" (the .plan altitude is relative to the takeoff)', () => {
    const f = describeFeature(featureId.waypoint(1), model, en)
    expect(f?.summary).toBe('30 m above takeoff')
    expect(f?.rows).toContainEqual([en.info.altitude, '30 m above takeoff'])
    expect(describeFeature(featureId.waypoint(0), model, en)?.title).toBe(en.info.takeoff)
    expect(describeFeature(featureId.waypoint(2), model, en)?.title).toBe(en.info.landing)
  })

  it('a volume: limits labelled with what the U-plan declares (AGL), feet converted', () => {
    const f = describeFeature(featureId.volume(0), model, en)
    expect(f?.title).toBe('seg 1')
    expect(f?.summary).toBe('10-121.9 m AGL')
    expect(f?.rows).toContainEqual([en.info.lower, '10 m AGL'])
    expect(f?.rows).toContainEqual([en.info.upper, '121.9 m AGL'])
  })

  it('zones: AGL, AMSL and mixed limits each carry their own reference', () => {
    expect(describeFeature(featureId.zone('A'), model, en)?.summary).toBe('0-120 m AGL')
    expect(describeFeature(featureId.zone('B'), model, en)?.summary).toBe('100-300 m AMSL')
    const c = describeFeature(featureId.zone('C'), model, en)
    expect(c?.summary).toBe('0 m AGL / 300 m AMSL')
    expect(c?.rows).toContainEqual([en.info.lower, '0 m AGL'])
    expect(c?.rows).toContainEqual([en.info.upper, '300 m AMSL'])
  })

  it('the Spanish texts state the references too', () => {
    expect(describeFeature(featureId.waypoint(1), model, es)?.summary).toBe('30 m sobre el despegue')
    expect(describeFeature(featureId.zone('B'), model, es)?.summary).toBe('100-300 m AMSL')
  })

  it('unknown ids -> null', () => {
    for (const id of [null, '', 'wp:99', 'vol:99', 'zone:nope', 'other:1', 'garbage']) expect(describeFeature(id, model, en)).toBeNull()
  })

  it('both languages define every alt format and viewer key the other has', () => {
    const keys = (o: object, p = ''): string[] => Object.entries(o).flatMap(([k, v]) => (v && typeof v === 'object' ? keys(v, `${p}${k}.`) : [`${p}${k}`]))
    expect(keys(es).sort()).toEqual(keys(en).sort())
    for (const f of [en.alt, es.alt]) for (const ref of ['AGL', 'HAT', 'AMSL', 'WGS84'] as const) expect(f[ref]).toContain('{n}')
  })
})

describe('listFeatures: the keyboard / touch way to every feature of the visible layers (the legend list)', () => {
  const zone = (id: string, vertical: object) => ({
    uas_geozones_identifier: id,
    properties: { name: `zone ${id}`, type: 'PROHIBITED' },
    geometry: { type: 'Polygon', coordinates: [[[-0.45, 39.7], [-0.44, 39.7], [-0.44, 39.71], [-0.45, 39.71]]], verticalReference: vertical },
  })
  const volume = (ordinal: number) => ({
    ordinal,
    name: `seg ${ordinal}`,
    geometry: { type: 'Polygon', coordinates: [[[-0.45, 39.7], [-0.449, 39.7], [-0.449, 39.701], [-0.45, 39.701]]] },
    minAltitude: { value: 10, reference: 'AGL', uom: 'M' },
    maxAltitude: { value: 400, reference: 'AGL', uom: 'FT' },
  })
  const build = (message: unknown = null, status: 'denied' | null = null) =>
    buildPlanViewModel({
      waypoints: [{ lat: 39.7, lng: -0.45, alt: 30 }, { lat: 39.701, lng: -0.449, alt: 30 }, { lat: 39.702, lng: -0.448, alt: 0 }],
      uplan: { operationVolumes: [volume(0), volume(1)] },
      csv: null,
      authorizationMessage: message,
      authStatus: status,
      geoawarenessData: null,
      liveZones: [zone('A', { lower: 0, upper: 120, lowerReference: 'AGL', upperReference: 'AGL', uom: 'M' }), zone('B', { lower: 100, upper: 300, lowerReference: 'AMSL', upperReference: 'AMSL', uom: 'M' })],
      uspaceId: 'VLCUspace',
    })
  const model = build()

  it('nothing visible -> an empty list', () => {
    expect(listFeatures(model, NONE, en)).toEqual([])
  })

  it('waypoints, then volumes, then zones, each with its title and its main altitude WITH its reference', () => {
    const items = listFeatures(model, { ...NONE, waypoints: true, volumes: true, zones: true }, en)
    expect(items.map((i) => i.id)).toEqual(['wp:0', 'wp:1', 'wp:2', 'vol:0', 'vol:1', 'zone:A', 'zone:B'])
    expect(items.map((i) => i.title)).toEqual([en.info.takeoff, 'Waypoint 2', en.info.landing, 'seg 0', 'seg 1', 'zone A', 'zone B'])
    expect(items.find((i) => i.id === 'wp:1')?.summary).toBe('30 m above takeoff')
    expect(items.find((i) => i.id === 'vol:0')?.summary).toBe('10-121.9 m AGL')
    expect(items.find((i) => i.id === 'zone:A')?.summary).toBe('0-120 m AGL')
    expect(items.find((i) => i.id === 'zone:B')?.summary).toBe('100-300 m AMSL')
  })

  it('only the layers that are on: no volumes layer -> no volume items; the trajectory layer adds no item', () => {
    expect(listFeatures(model, { ...NONE, waypoints: true }, en).map((i) => i.id)).toEqual(['wp:0', 'wp:1', 'wp:2'])
    expect(listFeatures(model, { ...NONE, volumes: true }, en).map((i) => i.id)).toEqual(['vol:0', 'vol:1'])
    expect(listFeatures(model, { ...NONE, trajectory: true }, en)).toEqual([])
  })

  it('zones follow zoneShown: the Result layer lists only the zones FAS named as conflicting', () => {
    expect(listFeatures(model, { ...NONE, result: true }, en)).toEqual([])
    const denied = build(JSON.stringify({ geozones_information: { conflicting_geozones: [{ identifier: 'B', type: 'prohibited', info: 'no' }] } }), 'denied')
    expect(listFeatures(denied, { ...NONE, result: true }, en).map((i) => i.id)).toEqual(['zone:B'])
    expect(listFeatures(denied, { ...NONE, zones: true }, en).map((i) => i.id)).toEqual(['zone:A', 'zone:B'])
  })

  it('picking an item opens the same card as a click: describeFeature(id) has the same title', () => {
    for (const it of listFeatures(model, ALL, en)) expect(describeFeature(it.id, model, en)?.title).toBe(it.title)
  })

  it('the numbers follow the language (Spanish decimal comma) in the list and in the card', () => {
    const items = listFeatures(model, { ...NONE, volumes: true }, es, 'es-ES')
    expect(items[0].summary).toBe('10-121,9 m AGL')
    const card = describeFeature(featureId.volume(0), model, es, 'es-ES')
    expect(card?.rows).toContainEqual([es.info.upper, '121,9 m AGL'])
    expect(describeFeature(featureId.volume(0), model, en, 'en-GB')?.rows).toContainEqual([en.info.upper, '121.9 m AGL'])
  })
})
