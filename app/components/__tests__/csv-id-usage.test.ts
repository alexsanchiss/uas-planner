/**
 * Static guard: the UI must never pass `plan.csvResult` as a csvresult id.
 *
 * `flightPlan.csvResult` is a 0/1 flag (CLAUDE.md "csvResult is a boolean flag, NOT an ID"); the
 * csvresult row has the SAME id as the plan. `/api/csvResult?id=${plan.csvResult}` asked for row 1,
 * which before F4 leaked another user's CSV and after the ownership fix is a 404 on every plan.
 * There is no React testing infrastructure, so this reads the component sources.
 */

import fs from 'fs';
import path from 'path';

const APP_DIR = path.join(__dirname, '..', '..');

function sourceFiles(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return entry.name === '__tests__' || entry.name === 'api' ? [] : sourceFiles(full);
    return /\.(ts|tsx)$/.test(entry.name) ? [full] : [];
  });
}

const files = sourceFiles(APP_DIR).map((file) => ({ file: path.relative(APP_DIR, file), text: fs.readFileSync(file, 'utf8') }));

describe('UI csvResult id usage', () => {
  it('finds the component sources it is meant to guard (the scan is not vacuous)', () => {
    expect(files.length).toBeGreaterThan(20);
    expect(files.some((f) => /api\/csvResult\?id=/.test(f.text))).toBe(true);
  });

  it('never builds /api/csvResult?id= from a .csvResult value', () => {
    const offenders = files.filter((f) => /api\/csvResult\?id=\$\{[^}]*\.csvResult[^}]*\}/.test(f.text)).map((f) => f.file);

    expect(offenders).toEqual([]);
  });

  it('never hands a .csvResult value to the CSV view/download helpers as the id', () => {
    const offenders = files.filter((f) => /\b(handleViewCsv|downloadCsv)\(\s*[\w.!?]*\.csvResult\b/.test(f.text)).map((f) => f.file);

    expect(offenders).toEqual([]);
  });
});
