/**
 * next.config.mjs: baseline security headers on every route (SEC-15).
 *
 * The config is an ES module outside jest's CommonJS transform, so it is loaded by a real Node
 * process (the same way Next.js loads it) and headers() is read from its JSON output.
 */

import { execFileSync } from 'child_process';
import { pathToFileURL } from 'url';
import path from 'path';

type HeaderRule = { source: string; headers: Array<{ key: string; value: string }> };

function loadHeaders(): HeaderRule[] {
  const configUrl = pathToFileURL(path.join(__dirname, '..', '..', 'next.config.mjs')).href;
  const script = `const c = (await import(${JSON.stringify(configUrl)})).default; process.stdout.write(JSON.stringify(await c.headers()));`;
  const out = execFileSync(process.execPath, ['--input-type=module', '-e', script], {
    env: { ...process.env, NODE_ENV: 'test', DATABASE_URL: 'mysql://ci:ci@127.0.0.1:3306/x', JWT_SECRET: 'ci-only' },
    encoding: 'utf8',
  });
  return JSON.parse(out);
}

describe('next.config.mjs headers()', () => {
  let rules: HeaderRule[] = [];

  beforeAll(() => {
    rules = loadHeaders();
  });

  it('applies one rule to every route', () => {
    expect(rules).toHaveLength(1);
    expect(rules[0].source).toBe('/:path*');
  });

  it('sends exactly the four baseline security headers', () => {
    const byKey = Object.fromEntries(rules[0].headers.map((h) => [h.key, h.value]));

    expect(Object.keys(byKey).sort()).toEqual(
      ['Permissions-Policy', 'Referrer-Policy', 'X-Content-Type-Options', 'X-Frame-Options'].sort(),
    );
    expect(byKey['X-Content-Type-Options']).toBe('nosniff');
    expect(byKey['X-Frame-Options']).toBe('SAMEORIGIN');
    expect(byKey['Referrer-Policy']).toBe('strict-origin-when-cross-origin');
    expect(byKey['Permissions-Policy']).toContain('camera=()');
    expect(byKey['Permissions-Policy']).toContain('microphone=()');
  });

  it('does not ship a Content-Security-Policy yet (would break Cesium/Leaflet; planned as Report-Only first)', () => {
    expect(rules[0].headers.map((h) => h.key.toLowerCase())).not.toContain('content-security-policy');
  });
});
