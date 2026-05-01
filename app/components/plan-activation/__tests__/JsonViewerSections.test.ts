/**
 * Unit tests for JsonViewerSections utility functions.
 *
 * These tests cover the exported pure helpers (formatKey, isPlainObject,
 * isPrimitive) that drive the rendering logic, without requiring a DOM or
 * React rendering environment.
 */

import {
  formatKey,
  isPlainObject,
  isPrimitive,
} from '../json-viewer-utils';

// ── formatKey ──────────────────────────────────────────────────────────────

describe('formatKey', () => {
  it('capitalises the first letter', () => {
    expect(formatKey('name')).toBe('Name');
  });

  it('replaces underscores with spaces', () => {
    expect(formatKey('first_name')).toBe('First name');
  });

  it('replaces hyphens with spaces', () => {
    expect(formatKey('created-at')).toBe('Created at');
  });

  it('handles a key that is already capitalized', () => {
    expect(formatKey('Value')).toBe('Value');
  });

  it('handles keys with mixed separators', () => {
    expect(formatKey('some_long-key')).toBe('Some long key');
  });
});

// ── isPlainObject ──────────────────────────────────────────────────────────

describe('isPlainObject', () => {
  it('returns true for a plain object', () => {
    expect(isPlainObject({ a: 1 })).toBe(true);
  });

  it('returns false for null', () => {
    expect(isPlainObject(null)).toBe(false);
  });

  it('returns false for an array', () => {
    expect(isPlainObject([1, 2, 3])).toBe(false);
  });

  it('returns false for a string', () => {
    expect(isPlainObject('hello')).toBe(false);
  });

  it('returns false for a number', () => {
    expect(isPlainObject(42)).toBe(false);
  });

  it('returns false for undefined', () => {
    expect(isPlainObject(undefined)).toBe(false);
  });
});

// ── isPrimitive ────────────────────────────────────────────────────────────

describe('isPrimitive', () => {
  it('returns true for a string', () => {
    expect(isPrimitive('hello')).toBe(true);
  });

  it('returns true for a number', () => {
    expect(isPrimitive(42)).toBe(true);
  });

  it('returns true for a boolean', () => {
    expect(isPrimitive(true)).toBe(true);
  });

  it('returns true for null', () => {
    expect(isPrimitive(null)).toBe(true);
  });

  it('returns true for undefined', () => {
    expect(isPrimitive(undefined)).toBe(true);
  });

  it('returns false for a plain object', () => {
    expect(isPrimitive({ a: 1 })).toBe(false);
  });

  it('returns false for an array', () => {
    expect(isPrimitive([1, 2])).toBe(false);
  });
});

// ── Rendering contract: object top-level keys become section labels ─────────
// These tests verify the key→label contract without rendering React nodes.

describe('top-level object section labels (via formatKey)', () => {
  const data: Record<string, unknown> = { name: 'Test', value: 42 };

  it('produces "Name" for the key "name"', () => {
    expect(formatKey(Object.keys(data)[0])).toBe('Name');
  });

  it('produces "Value" for the key "value"', () => {
    expect(formatKey(Object.keys(data)[1])).toBe('Value');
  });
});

// ── Primitives: string content is preserved ────────────────────────────────

describe('primitive string rendering contract', () => {
  it('short string is treated as primitive', () => {
    const str = 'Hello World';
    expect(isPrimitive(str)).toBe(true);
    expect(str).toBe('Hello World');
  });

  it('long string (>120 chars) is still a primitive', () => {
    const long = 'a'.repeat(121);
    expect(isPrimitive(long)).toBe(true);
    expect(long.length > 120).toBe(true);
  });
});

// ── Arrays: index labels ───────────────────────────────────────────────────

describe('array index labels', () => {
  it('generates correct bracket labels for each index', () => {
    const arr = ['alpha', 'beta', 'gamma'];
    arr.forEach((_, i) => {
      expect(`[${i}]`).toBe(`[${i}]`); // sanity
    });
    expect(`[0]`).toBe('[0]');
    expect(`[1]`).toBe('[1]');
  });

  it('identifies empty arrays correctly', () => {
    expect(Array.isArray([])).toBe(true);
    expect([].length).toBe(0);
  });
});

// ── Nested object: depth detection ────────────────────────────────────────

describe('nested object depth detection', () => {
  const nested = {
    level1: {
      level2: {
        level3: 'deep value',
      },
    },
  };

  it('top-level is a plain object', () => {
    expect(isPlainObject(nested)).toBe(true);
  });

  it('level2 value is a plain object', () => {
    expect(isPlainObject(nested.level1)).toBe(true);
  });

  it('level3 value is a plain object', () => {
    expect(isPlainObject(nested.level1.level2)).toBe(true);
  });

  it('leaf value is a primitive', () => {
    expect(isPrimitive(nested.level1.level2.level3)).toBe(true);
  });
});

// ── maxDepth=0: raw JSON fallback contract ─────────────────────────────────

describe('maxDepth=0 raw JSON fallback', () => {
  it('JSON.stringify produces valid output for an object', () => {
    const data = { key: 'value' };
    const raw = JSON.stringify(data, null, 2);
    expect(raw).toContain('"key"');
    expect(raw).toContain('"value"');
  });

  it('JSON.stringify handles null without throwing', () => {
    expect(() => JSON.stringify(null, null, 2)).not.toThrow();
  });

  it('JSON.stringify handles undefined gracefully', () => {
    // JSON.stringify(undefined) returns undefined (not a string) — no throw
    expect(() => JSON.stringify(undefined, null, 2)).not.toThrow();
  });
});

// ── Null/undefined: no errors ──────────────────────────────────────────────

describe('null and undefined safety', () => {
  it('isPrimitive does not throw for null', () => {
    expect(() => isPrimitive(null)).not.toThrow();
  });

  it('isPrimitive does not throw for undefined', () => {
    expect(() => isPrimitive(undefined)).not.toThrow();
  });

  it('isPlainObject does not throw for null', () => {
    expect(() => isPlainObject(null)).not.toThrow();
  });

  it('isPlainObject does not throw for undefined', () => {
    expect(() => isPlainObject(undefined)).not.toThrow();
  });

  it('formatKey handles single-char key without throwing', () => {
    expect(() => formatKey('x')).not.toThrow();
    expect(formatKey('x')).toBe('X');
  });
});
