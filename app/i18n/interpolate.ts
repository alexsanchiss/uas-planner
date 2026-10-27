/**
 * Helper function to interpolate variables in translation strings (no React: usable from pure modules and tests)
 * Usage: interpolate(t.time.minutesAgo, { n: 5 }) -> "5 minutes ago"
 */
export function interpolate(template: string, vars: Record<string, string | number>): string {
  return template.replace(/{(\w+)}/g, (_, key) => String(vars[key] ?? `{${key}}`))
}
