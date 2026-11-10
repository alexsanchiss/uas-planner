/** simulationText (pure) and the en/es parity of the new `sim` and `processing` dictionaries. */
import { planAuthEn, planAuthEs } from '@/app/i18n/planAuthorization';
import { PROCESSING_ERROR_CODES } from '@/lib/simulation';
import { isDefaultSimulation, simulationSummary as rawSummary, simulationShort as rawShort } from '../simulationText';

// The en dictionary uses a no-break space before units; compare with plain spaces.
const nb = (v: string | null) => (v === null ? v : v.replace(/ /g, ' '));
const simulationSummary = ((...a: Parameters<typeof rawSummary>) => nb(rawSummary(...a)) as string) as typeof rawSummary;
const simulationShort = ((...a: Parameters<typeof rawShort>) => nb(rawShort(...a))) as typeof rawShort;

const en = planAuthEn.sim;
const es = planAuthEs.sim;

describe('isDefaultSimulation', () => {
  it('is true only for multirotor without wind', () => {
    expect(isDefaultSimulation({ airframe: 'multirotor', wind: null })).toBe(true);
    expect(isDefaultSimulation({ airframe: 'fixedwing', wind: null })).toBe(false);
    expect(isDefaultSimulation({ airframe: 'multirotor', wind: { speed: 3, direction: 0, gust: null } })).toBe(false);
  });
});

describe('simulationSummary', () => {
  it('no wind', () => {
    expect(simulationSummary({ airframe: 'multirotor', wind: null }, en, 'en')).toBe('Multirotor · no wind');
    expect(simulationSummary({ airframe: 'fixedwing', wind: null }, es, 'es')).toBe('Ala fija · sin viento');
  });

  it('wind with and without gusts', () => {
    const wind = { speed: 8, direction: 270, gust: null };
    expect(simulationSummary({ airframe: 'fixedwing', wind }, en, 'en')).toBe('Fixed wing · wind 8 m/s from 270°');
    expect(simulationSummary({ airframe: 'fixedwing', wind: { ...wind, gust: 12 } }, en, 'en')).toBe(
      'Fixed wing · wind 8 m/s from 270°, gusts 12 m/s'
    );
  });

  it('formats decimals with the language separator and rounds to 2 decimals', () => {
    const s = { airframe: 'multirotor' as const, wind: { speed: 8.5, direction: 90.126, gust: null } };
    expect(simulationSummary(s, en, 'en')).toContain('8.5 m/s from 90.13°');
    expect(simulationSummary(s, es, 'es')).toContain('8,5 m/s desde 90,13°');
  });

  it('a gust of 0 is still shown (only null means constant wind)', () => {
    expect(simulationSummary({ airframe: 'multirotor', wind: { speed: 0.5, direction: 0, gust: 0 } }, en, 'en')).toContain(
      'gusts 0 m/s'
    );
  });
});

describe('simulationShort', () => {
  it('null for the default settings', () => {
    expect(simulationShort({ airframe: 'multirotor', wind: null }, en, 'en')).toBeNull();
  });

  it('only the aircraft when there is no wind', () => {
    expect(simulationShort({ airframe: 'fixedwing', wind: null }, en, 'en')).toBe('Fixed wing');
  });

  it('aircraft and speed with wind', () => {
    expect(simulationShort({ airframe: 'fixedwing', wind: { speed: 8, direction: 10, gust: 12 } }, en, 'en')).toBe(
      'Fixed wing · 8 m/s'
    );
    expect(simulationShort({ airframe: 'multirotor', wind: { speed: 2.5, direction: 10, gust: null } }, es, 'es')).toBe(
      'Multirotor · 2,5 m/s'
    );
  });
});

describe('dictionary parity (en / es)', () => {
  const keysOf = (o: unknown, prefix = ''): string[] =>
    Object.entries(o as Record<string, unknown>).flatMap(([k, v]) =>
      typeof v === 'object' && v !== null ? keysOf(v, `${prefix}${k}.`) : [`${prefix}${k}`]
    );
  const get = (o: unknown, dotted: string) => dotted.split('.').reduce<unknown>((a, k) => (a as Record<string, unknown>)[k], o);
  const placeholders = (s: string) => (s.match(/{\w+}/g) ?? []).sort().join(',');

  it.each(['sim', 'processing'] as const)('%s has the same keys, non-empty strings and the same placeholders in both languages', (block) => {
    const enKeys = keysOf(planAuthEn[block]).sort();
    expect(keysOf(planAuthEs[block]).sort()).toEqual(enKeys);
    for (const k of enKeys) {
      const e = get(planAuthEn[block], k) as string;
      const s = get(planAuthEs[block], k) as string;
      expect(e.trim()).not.toBe('');
      expect(s.trim()).not.toBe('');
      expect(placeholders(s)).toBe(placeholders(e));
    }
  });

  it('every processing error code has a message in both languages, plus "unknown"', () => {
    for (const dict of [planAuthEn, planAuthEs]) {
      for (const code of [...PROCESSING_ERROR_CODES, 'unknown'] as const) {
        expect(dict.processing.errors[code]).toEqual(expect.any(String));
      }
    }
  });
});
