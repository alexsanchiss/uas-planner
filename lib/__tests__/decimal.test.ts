/** parseDecimal: "." or "," as the single decimal separator; NaN for anything else. */
import { parseDecimal } from '../decimal';

describe('parseDecimal', () => {
  it.each([
    ['5', 5],
    ['5.5', 5.5],
    ['5,5', 5.5],
    ['-3,2', -3.2],
    ['-3.2', -3.2],
    ['+1,5', 1.5],
    ['5.', 5], // half-typed: "5," while typing must not be rejected
    ['5,', 5],
    ['.5', 0.5],
    [',5', 0.5],
    ['-.5', -0.5],
    ['-,5', -0.5],
    ['00,5', 0.5],
    ['  7,25  ', 7.25],
    ['39,4567891', 39.4567891],
  ])('accepts %j -> %d', (raw, expected) => {
    expect(parseDecimal(raw)).toBe(expected);
  });

  it('keeps the value of "-0" and "0,0" as zero', () => {
    expect(parseDecimal('-0') === 0).toBe(true);
    expect(parseDecimal('0,0')).toBe(0);
  });

  it.each([
    '',
    '   ',
    '-',
    '+',
    '.',
    ',',
    '-,',
    'abc',
    '5 m',
    '1 2',
    '1,2,3',
    '1.2.3',
    '1,2.3',
    '1.234,5', // two separators: ambiguous, rejected on purpose
    '1e3',
    '1E-3',
    '0x10',
    '--1',
    '+-1',
    'Infinity',
    'NaN',
    '٣', // non-ASCII digit
  ])('rejects %j', (raw) => {
    expect(parseDecimal(raw)).toBeNaN();
  });

  it('passes finite numbers through and rejects non-finite ones', () => {
    expect(parseDecimal(3.5)).toBe(3.5);
    expect(parseDecimal(-2)).toBe(-2);
    expect(parseDecimal(0)).toBe(0);
    expect(parseDecimal(NaN)).toBeNaN();
    expect(parseDecimal(Infinity)).toBeNaN();
    expect(parseDecimal(-Infinity)).toBeNaN();
  });
});
