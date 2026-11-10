/** simulationOf (row -> settings) and parseProcessingError ("<code>: <detail>"). */
import { PROCESSING_ERROR_CODES, parseProcessingError, simulationOf } from '../simulation';

describe('simulationOf', () => {
  it('defaults an empty row to multirotor without wind', () => {
    expect(simulationOf({})).toEqual({ airframe: 'multirotor', wind: null });
    expect(simulationOf({ simAirframe: null, windSpeed: null, windDirection: null, windGust: null })).toEqual({
      airframe: 'multirotor',
      wind: null,
    });
  });

  it('reads fixedwing; any other value is multirotor', () => {
    expect(simulationOf({ simAirframe: 'fixedwing' }).airframe).toBe('fixedwing');
    expect(simulationOf({ simAirframe: 'multirotor' }).airframe).toBe('multirotor');
    expect(simulationOf({ simAirframe: 'helicopter' }).airframe).toBe('multirotor');
    expect(simulationOf({ simAirframe: '' }).airframe).toBe('multirotor');
  });

  it('treats windSpeed null, 0, negative or NaN as no wind, even with direction and gust set', () => {
    for (const windSpeed of [null, 0, -3, NaN]) {
      expect(simulationOf({ windSpeed, windDirection: 90, windGust: 12 }).wind).toBeNull();
    }
  });

  it('builds the wind from the columns', () => {
    expect(simulationOf({ simAirframe: 'fixedwing', windSpeed: 8, windDirection: 270, windGust: 12 })).toEqual({
      airframe: 'fixedwing',
      wind: { speed: 8, direction: 270, gust: 12 },
    });
  });

  it('null gust = constant wind; null direction = 0', () => {
    expect(simulationOf({ windSpeed: 5, windDirection: null, windGust: null }).wind).toEqual({
      speed: 5,
      direction: 0,
      gust: null,
    });
  });
});

describe('parseProcessingError', () => {
  it('returns null for null (no error stored)', () => {
    expect(parseProcessingError(null)).toBeNull();
  });

  it('splits a known code from its detail', () => {
    expect(parseProcessingError('timeout: no progress for 600 s')).toEqual({
      code: 'timeout',
      detail: 'no progress for 600 s',
    });
  });

  it.each([...PROCESSING_ERROR_CODES])('recognises the code %s', (code) => {
    expect(parseProcessingError(`${code}: detail`)).toEqual({ code, detail: 'detail' });
  });

  it('keeps the colons that belong to the detail', () => {
    expect(parseProcessingError('mission_rejected: PX4 said: no: way')).toEqual({
      code: 'mission_rejected',
      detail: 'PX4 said: no: way',
    });
  });

  it('accepts a code with an empty detail', () => {
    expect(parseProcessingError('px4_start:')).toEqual({ code: 'px4_start', detail: '' });
  });

  it('unknown code -> code null and the whole text as detail', () => {
    expect(parseProcessingError('weird_code: something')).toEqual({ code: null, detail: 'weird_code: something' });
  });

  it('text without a code -> code null and the whole text as detail', () => {
    expect(parseProcessingError('Traceback (most recent call last)')).toEqual({
      code: null,
      detail: 'Traceback (most recent call last)',
    });
    expect(parseProcessingError(': leading colon')).toEqual({ code: null, detail: ': leading colon' });
  });

  it('tolerates spaces around the code', () => {
    expect(parseProcessingError(' internal : boom')).toEqual({ code: 'internal', detail: 'boom' });
  });

  it('an empty string is an error without code or detail (not "no error")', () => {
    expect(parseProcessingError('')).toEqual({ code: null, detail: '' });
  });
});
