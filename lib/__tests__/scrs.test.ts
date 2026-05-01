import { parseScrsAlternative, ScrsAlternative } from '../scrs'

// The real FAS message from the task specification
const REAL_FAS_MESSAGE =
  '{"volumes":[13],"geozones_information":{"number_conflicting_geozones":0,"conflicting_geozones":[]},"scr_dispatch":{"sent":true,"status_code":200,"response":{"status":"success","uplan_id":"0860197d-beeb-4a31-b9fc-ac83d41cabac","segments":[{"segment":1,"start":{"type":"Point","coordinates":[-0.3600168228149414,39.48039416285373,100]},"end":{"type":"Point","coordinates":[-0.35061836242675787,39.476221270402874,100]},"solution_method":"ML","len_path":19,"t_path":0.07237690000329167,"route_path":[{"type":"Point","coordinates":[-0.3599709765397333,39.48032815661779,100]},{"type":"Point","coordinates":[-0.3594012646170611,39.48000084226529,100]},{"type":"Point","coordinates":[-0.3588315580315235,39.479673525101234,100]},{"type":"Point","coordinates":[-0.3582618567831581,39.47934620512571,100]},{"type":"Point","coordinates":[-0.3576922058358685,39.47967357769847,100]},{"type":"Point","coordinates":[-0.3571225099235536,39.4793462521408,100]},{"type":"Point","coordinates":[-0.35655281934862376,39.47901892377192,100]},{"type":"Point","coordinates":[-0.3559831341111168,39.47869159259196,100]},{"type":"Point","coordinates":[-0.3554134542110701,39.478364258601,100]},{"type":"Point","coordinates":[-0.35484377964852165,39.47803692179922,100]},{"type":"Point","coordinates":[-0.3542741104235087,39.47770958218672,100]},{"type":"Point","coordinates":[-0.3537044465360692,39.4773822397636,100]},{"type":"Point","coordinates":[-0.35313478798624043,39.477054894529985,100]},{"type":"Point","coordinates":[-0.353134789115962,39.477382242340155,100]},{"type":"Point","coordinates":[-0.35313478798624043,39.477054894529985,100]},{"type":"Point","coordinates":[-0.35256513477406026,39.476727546486,100]},{"type":"Point","coordinates":[-0.3519954826916559,39.476727543481445,100]},{"type":"Point","coordinates":[-0.35142583748614464,39.476400189836745,100]},{"type":"Point","coordinates":[-0.3508561976184446,39.47607283338197,100]}]},{"segment":2,"start":{"type":"Point","coordinates":[-0.35061836242675787,39.476221270402874,100]},"end":{"type":"Point","coordinates":[-0.3439879417419434,39.468242438482825,100]},"solution_method":"ML","len_path":25,"t_path":0.004089100053533912,"route_path":[{"type":"Point","coordinates":[-0.3508561976184446,39.47607283338197,100]},{"type":"Point","coordinates":[-0.3502865630885935,39.475745474117254,100]},{"type":"Point","coordinates":[-0.3497169338966288,39.47541811204269,100]},{"type":"Point","coordinates":[-0.34914731004258814,39.47509074715841,100]},{"type":"Point","coordinates":[-0.3485776915265091,39.47476337946452,100]},{"type":"Point","coordinates":[-0.3480080783484292,39.47443600896117,100]},{"type":"Point","coordinates":[-0.347438470508386,39.474108635648435,100]},{"type":"Point","coordinates":[-0.3468688680064171,39.47378125952647,100]},{"type":"Point","coordinates":[-0.34629927084255996,39.473453880595365,100]},{"type":"Point","coordinates":[-0.34572967901685225,39.47312649885525,100]},{"type":"Point","coordinates":[-0.3451600925293315,39.47279911430625,100]},{"type":"Point","coordinates":[-0.34459051138003516,39.47247172694847,100]},{"type":"Point","coordinates":[-0.34402093556900076,39.472144336782044,100]},{"type":"Point","coordinates":[-0.34345136509626595,39.47181694380707,100]},{"type":"Point","coordinates":[-0.34345140933003676,39.47148959566773,100]},{"type":"Point","coordinates":[-0.3428818468636295,39.47116219986545,100]},{"type":"Point","coordinates":[-0.3434514977963352,39.470834899330754,100]},{"type":"Point","coordinates":[-0.3440211433937579,39.470507595985666,100]},{"type":"Point","coordinates":[-0.3440211849575411,39.47018024776819,100]},{"type":"Point","coordinates":[-0.34402122652093486,39.469852899531375,100]},{"type":"Point","coordinates":[-0.34345167472395904,39.46952550642431,100]},{"type":"Point","coordinates":[-0.343451718954829,39.46919815814938,100]},{"type":"Point","coordinates":[-0.34345176318528453,39.46887080985518,100]},{"type":"Point","coordinates":[-0.3440213927706157,39.46854350639109,100]},{"type":"Point","coordinates":[-0.3440214343320625,39.46821615805787,100]}]}]}}}'

describe('parseScrsAlternative', () => {
  describe('1. Input vacío / null', () => {
    it('returns null for null input', () => {
      expect(parseScrsAlternative(null)).toBeNull()
    })

    it('returns null for undefined input', () => {
      expect(parseScrsAlternative(undefined)).toBeNull()
    })

    it('returns null for empty string', () => {
      expect(parseScrsAlternative('')).toBeNull()
    })
  })

  describe('2. Input malformado (JSON inválido)', () => {
    it('returns null for invalid JSON', () => {
      expect(parseScrsAlternative('{bad json}')).toBeNull()
    })

    it('returns null for non-object JSON', () => {
      expect(parseScrsAlternative('"just a string"')).toBeNull()
    })

    it('returns null for JSON array', () => {
      expect(parseScrsAlternative('[1, 2, 3]')).toBeNull()
    })
  })

  describe('3. Guard: sent=false', () => {
    it('returns null when scr_dispatch.sent is false', () => {
      const msg = JSON.stringify({
        scr_dispatch: {
          sent: false,
          status_code: 200,
          response: {
            status: 'success',
            uplan_id: 'abc',
            segments: [
              {
                segment: 1,
                start: { type: 'Point', coordinates: [-0.36, 39.48, 100] },
                end: { type: 'Point', coordinates: [-0.35, 39.47, 100] },
                solution_method: 'ML',
                route_path: [
                  { type: 'Point', coordinates: [-0.36, 39.48, 100] },
                  { type: 'Point', coordinates: [-0.35, 39.47, 100] },
                ],
              },
            ],
          },
        },
      })
      expect(parseScrsAlternative(msg)).toBeNull()
    })

    it('returns null when scr_dispatch is missing', () => {
      const msg = JSON.stringify({ volumes: [1] })
      expect(parseScrsAlternative(msg)).toBeNull()
    })
  })

  describe('4. Guard: status_code != 200', () => {
    it('returns null when status_code is 404', () => {
      const msg = JSON.stringify({
        scr_dispatch: {
          sent: true,
          status_code: 404,
          response: {
            status: 'success',
            uplan_id: 'abc',
            segments: [
              {
                segment: 1,
                start: { type: 'Point', coordinates: [-0.36, 39.48, 100] },
                end: { type: 'Point', coordinates: [-0.35, 39.47, 100] },
                solution_method: 'ML',
                route_path: [
                  { type: 'Point', coordinates: [-0.36, 39.48, 100] },
                ],
              },
            ],
          },
        },
      })
      expect(parseScrsAlternative(msg)).toBeNull()
    })

    it('returns null when status_code is 500', () => {
      const msg = JSON.stringify({
        scr_dispatch: {
          sent: true,
          status_code: 500,
          response: { status: 'success', uplan_id: 'abc', segments: [] },
        },
      })
      expect(parseScrsAlternative(msg)).toBeNull()
    })
  })

  describe('5. Guard: response.status != "success"', () => {
    it('returns null when response status is "error"', () => {
      const msg = JSON.stringify({
        scr_dispatch: {
          sent: true,
          status_code: 200,
          response: {
            status: 'error',
            uplan_id: 'abc',
            segments: [
              {
                segment: 1,
                start: { type: 'Point', coordinates: [-0.36, 39.48, 100] },
                end: { type: 'Point', coordinates: [-0.35, 39.47, 100] },
                solution_method: 'ML',
                route_path: [
                  { type: 'Point', coordinates: [-0.36, 39.48, 100] },
                ],
              },
            ],
          },
        },
      })
      expect(parseScrsAlternative(msg)).toBeNull()
    })

    it('returns null when response status is "pending"', () => {
      const msg = JSON.stringify({
        scr_dispatch: {
          sent: true,
          status_code: 200,
          response: { status: 'pending', uplan_id: 'abc', segments: [] },
        },
      })
      expect(parseScrsAlternative(msg)).toBeNull()
    })
  })

  describe('6. Guard: segments vacíos', () => {
    it('returns null when segments array is empty', () => {
      const msg = JSON.stringify({
        scr_dispatch: {
          sent: true,
          status_code: 200,
          response: {
            status: 'success',
            uplan_id: 'abc',
            segments: [],
          },
        },
      })
      expect(parseScrsAlternative(msg)).toBeNull()
    })

    it('returns null when segments field is missing', () => {
      const msg = JSON.stringify({
        scr_dispatch: {
          sent: true,
          status_code: 200,
          response: {
            status: 'success',
            uplan_id: 'abc',
          },
        },
      })
      expect(parseScrsAlternative(msg)).toBeNull()
    })
  })

  describe('7. Caso válido — mensaje real del FAS', () => {
    let result: ScrsAlternative | null

    beforeEach(() => {
      result = parseScrsAlternative(REAL_FAS_MESSAGE)
    })

    it('returns a non-null result', () => {
      expect(result).not.toBeNull()
    })

    it('has the correct uplanId', () => {
      expect(result!.uplanId).toBe('0860197d-beeb-4a31-b9fc-ac83d41cabac')
    })

    it('has 2 segments', () => {
      expect(result!.segments).toHaveLength(2)
    })

    it('segment 1 has 19 routePath points', () => {
      expect(result!.segments[0].routePath).toHaveLength(19)
    })

    it('segment 2 has 25 routePath points', () => {
      expect(result!.segments[1].routePath).toHaveLength(25)
    })

    it('flatWaypoints has 43 points (19+25 minus 1 duplicate at seam)', () => {
      // The last point of seg1 and the first point of seg2 are both
      // [-0.3508561976184446, 39.47607283338197, 100] → deduplicated → 43
      expect(result!.flatWaypoints).toHaveLength(43)
    })

    it('first flatWaypoint has correct lat from GeoJSON [lon, lat, alt]', () => {
      // First point of seg1 route_path: coordinates[-0.3599709765397333, 39.48032815661779, 100]
      // GeoJSON: [lon, lat, alt] → lat = 39.48032815661779
      expect(result!.flatWaypoints[0].lat).toBeCloseTo(39.48032815661779, 10)
    })

    it('first flatWaypoint has correct lon from GeoJSON [lon, lat, alt]', () => {
      // GeoJSON: [lon, lat, alt] → lon = -0.3599709765397333
      expect(result!.flatWaypoints[0].lon).toBeCloseTo(-0.3599709765397333, 10)
    })

    it('first flatWaypoint has correct alt', () => {
      expect(result!.flatWaypoints[0].alt).toBe(100)
    })

    it('segments are ordered by segment number', () => {
      expect(result!.segments[0].segment).toBe(1)
      expect(result!.segments[1].segment).toBe(2)
    })

    it('segments have correct solutionMethod', () => {
      expect(result!.segments[0].solutionMethod).toBe('ML')
      expect(result!.segments[1].solutionMethod).toBe('ML')
    })

    it('segment start coordinates are correctly parsed from GeoJSON', () => {
      // seg1 start: coordinates[-0.3600168228149414, 39.48039416285373, 100]
      expect(result!.segments[0].start.lat).toBeCloseTo(39.48039416285373, 10)
      expect(result!.segments[0].start.lon).toBeCloseTo(-0.3600168228149414, 10)
      expect(result!.segments[0].start.alt).toBe(100)
    })
  })

  describe('8. Deduplicación en costuras', () => {
    it('removes duplicate waypoint at seam between segments', () => {
      const sharedPoint = { type: 'Point', coordinates: [-0.35, 39.47, 100] }
      const msg = JSON.stringify({
        scr_dispatch: {
          sent: true,
          status_code: 200,
          response: {
            status: 'success',
            uplan_id: 'test-dedup',
            segments: [
              {
                segment: 1,
                start: { type: 'Point', coordinates: [-0.36, 39.48, 100] },
                end: sharedPoint,
                solution_method: 'ML',
                route_path: [
                  { type: 'Point', coordinates: [-0.36, 39.48, 100] },
                  { type: 'Point', coordinates: [-0.355, 39.475, 100] },
                  sharedPoint,
                ],
              },
              {
                segment: 2,
                start: sharedPoint,
                end: { type: 'Point', coordinates: [-0.34, 39.46, 100] },
                solution_method: 'ML',
                route_path: [
                  sharedPoint,
                  { type: 'Point', coordinates: [-0.345, 39.465, 100] },
                  { type: 'Point', coordinates: [-0.34, 39.46, 100] },
                ],
              },
            ],
          },
        },
      })
      const result = parseScrsAlternative(msg)
      expect(result).not.toBeNull()
      // 3 points from seg1 + 3 points from seg2 - 1 duplicate = 5
      expect(result!.flatWaypoints).toHaveLength(5)
      // The seam point should appear exactly once
      const seamPoints = result!.flatWaypoints.filter(
        (wp) => Math.abs(wp.lon - (-0.35)) < 1e-9 && Math.abs(wp.lat - 39.47) < 1e-9
      )
      expect(seamPoints).toHaveLength(1)
    })

    it('does not deduplicate non-identical adjacent points', () => {
      const msg = JSON.stringify({
        scr_dispatch: {
          sent: true,
          status_code: 200,
          response: {
            status: 'success',
            uplan_id: 'test-no-dedup',
            segments: [
              {
                segment: 1,
                start: { type: 'Point', coordinates: [-0.36, 39.48, 100] },
                end: { type: 'Point', coordinates: [-0.35, 39.47, 100] },
                solution_method: 'ML',
                route_path: [
                  { type: 'Point', coordinates: [-0.36, 39.48, 100] },
                  { type: 'Point', coordinates: [-0.35, 39.47, 100] },
                ],
              },
              {
                segment: 2,
                start: { type: 'Point', coordinates: [-0.35, 39.47, 100] },
                end: { type: 'Point', coordinates: [-0.34, 39.46, 100] },
                solution_method: 'ML',
                route_path: [
                  // Different first point (no overlap)
                  { type: 'Point', coordinates: [-0.349, 39.469, 100] },
                  { type: 'Point', coordinates: [-0.34, 39.46, 100] },
                ],
              },
            ],
          },
        },
      })
      const result = parseScrsAlternative(msg)
      expect(result).not.toBeNull()
      // 2 + 2 = 4 (no dedup since first points differ)
      expect(result!.flatWaypoints).toHaveLength(4)
    })

    it('uses [start, end] as routePath when route_path is empty', () => {
      const msg = JSON.stringify({
        scr_dispatch: {
          sent: true,
          status_code: 200,
          response: {
            status: 'success',
            uplan_id: 'test-fallback',
            segments: [
              {
                segment: 1,
                start: { type: 'Point', coordinates: [-0.36, 39.48, 100] },
                end: { type: 'Point', coordinates: [-0.35, 39.47, 100] },
                solution_method: 'ML',
                route_path: [],
              },
            ],
          },
        },
      })
      const result = parseScrsAlternative(msg)
      expect(result).not.toBeNull()
      expect(result!.flatWaypoints).toHaveLength(2)
      expect(result!.flatWaypoints[0].lat).toBeCloseTo(39.48, 10)
      expect(result!.flatWaypoints[1].lat).toBeCloseTo(39.47, 10)
    })

    it('sorts segments by segment number even if out of order in input', () => {
      const msg = JSON.stringify({
        scr_dispatch: {
          sent: true,
          status_code: 200,
          response: {
            status: 'success',
            uplan_id: 'test-sort',
            segments: [
              {
                segment: 2,
                start: { type: 'Point', coordinates: [-0.35, 39.47, 100] },
                end: { type: 'Point', coordinates: [-0.34, 39.46, 100] },
                solution_method: 'ML',
                route_path: [
                  { type: 'Point', coordinates: [-0.35, 39.47, 100] },
                  { type: 'Point', coordinates: [-0.34, 39.46, 100] },
                ],
              },
              {
                segment: 1,
                start: { type: 'Point', coordinates: [-0.36, 39.48, 100] },
                end: { type: 'Point', coordinates: [-0.35, 39.47, 100] },
                solution_method: 'ML',
                route_path: [
                  { type: 'Point', coordinates: [-0.36, 39.48, 100] },
                  { type: 'Point', coordinates: [-0.35, 39.47, 100] },
                ],
              },
            ],
          },
        },
      })
      const result = parseScrsAlternative(msg)
      expect(result).not.toBeNull()
      expect(result!.segments[0].segment).toBe(1)
      expect(result!.segments[1].segment).toBe(2)
      // First flatWaypoint should come from segment 1
      expect(result!.flatWaypoints[0].lat).toBeCloseTo(39.48, 10)
    })
  })
})
