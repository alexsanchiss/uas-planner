/**
 * lib/uplan/random-data.ts: the ONE rule shared by server (tray_to_uplan, generate-volumes) and
 * client (FlightPlansUploader): random placeholder U-Plan data is generated unless the variable is
 * exactly 'false'. Before F5b the client used `=== 'true'`, so with the variable unset server and
 * client disagreed.
 */

import { shouldGenerateRandomUplan } from '../uplan/random-data';

const KEY = 'NEXT_PUBLIC_GENERATE_RANDOM_UPLAN_DATA';
const original = process.env[KEY];

afterEach(() => {
  if (original === undefined) delete process.env[KEY];
  else process.env[KEY] = original;
});

describe('shouldGenerateRandomUplan', () => {
  it('is on when the variable is unset (documented default)', () => {
    delete process.env[KEY];
    expect(shouldGenerateRandomUplan()).toBe(true);
  });

  it("is on for 'true' and off only for exactly 'false'", () => {
    process.env[KEY] = 'true';
    expect(shouldGenerateRandomUplan()).toBe(true);
    process.env[KEY] = 'false';
    expect(shouldGenerateRandomUplan()).toBe(false);
  });

  it("anything that is not exactly 'false' keeps it on (same as the server always did)", () => {
    for (const v of ['', 'FALSE', '0', 'no', ' false']) {
      process.env[KEY] = v;
      expect(shouldGenerateRandomUplan()).toBe(true);
    }
  });
});
