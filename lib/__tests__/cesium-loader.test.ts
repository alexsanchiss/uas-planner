/**
 * lib/cesium-loader.ts: single loader behind the 5 Cesium modals. Before F5b each modal injected its
 * own <script>. Node env with a hand-made window/document: appended nodes are recorded and the test
 * fires onload/onerror itself.
 */

type FakeEl = { tag: string; href?: string; src?: string; onload?: () => void; onerror?: () => void };
const g = globalThis as unknown as Record<string, unknown>;
let appended: FakeEl[];
let win: Record<string, unknown>;

beforeEach(() => {
  appended = [];
  win = {};
  g.window = win;
  g.document = {
    head: { appendChild: (el: FakeEl) => void appended.push(el) },
    // only used for the stylesheet check: matches a previously appended <link> with the same href
    querySelector: (sel: string) => appended.find((el) => el.tag === 'link' && !!el.href && sel.includes(el.href)) ?? null,
    createElement: (tag: string): FakeEl => ({ tag }),
  };
});

afterEach(() => {
  delete g.window;
  delete g.document;
});

const scripts = () => appended.filter((e) => e.tag === 'script');
const links = () => appended.filter((e) => e.tag === 'link');
const fakeCesium = () => ({ Ion: { defaultAccessToken: '' } });

/** Fresh module instance so the module-level `pending` promise does not leak between tests. */
async function freshLoader() {
  let mod!: typeof import('../cesium-loader');
  await jest.isolateModulesAsync(async () => {
    mod = await import('../cesium-loader');
  });
  return mod.loadCesium;
}

describe('loadCesium', () => {
  it('injects ONE script and ONE stylesheet for concurrent callers, who all get the same Cesium', async () => {
    const loadCesium = await freshLoader();

    const calls = [loadCesium('tok'), loadCesium('tok'), loadCesium('tok')];
    expect(scripts()).toHaveLength(1);
    expect(scripts()[0].src).toBe('/cesium/Cesium.js');
    expect(links()).toHaveLength(1);

    const cesium = fakeCesium();
    win.Cesium = cesium;
    scripts()[0].onload?.();
    const out = await Promise.all(calls);

    expect(out).toEqual([cesium, cesium, cesium]);
    expect(cesium.Ion.defaultAccessToken).toBe('tok');
    expect(win.CESIUM_BASE_URL).toBe('/cesium');
  });

  it('does not touch the DOM when Cesium is already on window, and still applies the token', async () => {
    const loadCesium = await freshLoader();
    win.Cesium = fakeCesium();

    const c = await loadCesium('t2');

    expect(appended).toHaveLength(0);
    expect(c.Ion.defaultAccessToken).toBe('t2');
  });

  it('does not cache a failure: the next call injects a fresh script and can succeed', async () => {
    const loadCesium = await freshLoader();

    const first = loadCesium('t');
    scripts()[0].onerror?.();
    await expect(first).rejects.toThrow('Failed to load Cesium script');

    const second = loadCesium('t');
    expect(scripts()).toHaveLength(2);
    win.Cesium = fakeCesium();
    scripts()[1].onload?.();
    await expect(second).resolves.toBe(win.Cesium);
  });

  it('rejects when the script loads but defines no Cesium global', async () => {
    const loadCesium = await freshLoader();

    const p = loadCesium('t');
    scripts()[0].onload?.();

    await expect(p).rejects.toThrow('Cesium failed to load');
  });
});
