/**
 * Pure utility functions for JsonViewerSections.
 * Kept in a separate .ts file so they can be unit-tested without a JSX/DOM
 * environment.
 */

/** Converts a snake_case / kebab-case key to a human-readable label. */
export function formatKey(key: string): string {
  return key
    .replace(/[_-]/g, ' ')
    .replace(/^./, (c) => c.toUpperCase());
}

/** Returns true when the value is a plain (non-null, non-array) object. */
export function isPlainObject(value: unknown): value is Record<string, unknown> {
  return (
    typeof value === 'object' &&
    value !== null &&
    !Array.isArray(value)
  );
}

/** Returns true when the value is a primitive (string, number, boolean, null, undefined). */
export function isPrimitive(
  value: unknown,
): value is string | number | boolean | null | undefined {
  return value === null || value === undefined || typeof value !== 'object';
}
