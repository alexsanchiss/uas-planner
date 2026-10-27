/**
 * useFolderPlans (F12): the production list loads, per refresh, only what is on screen. The hook runs on a tiny hooks
 * runtime (jest.mock of 'react': state / refs live in slots, `rerender()` runs the hook again, effects never run, so no DOM
 * is needed) over a mocked useFlightPlans, which hands us the `fetcher` the hook passes to it: that is `loadAll`, the
 * function every poll / mutation / "show more" runs, and takes back the rows it published (`seen.plans`). A fake server
 * answers the paging URLs, so the assertions are on WHICH requests a refresh makes and what the list then shows.
 */

jest.mock('react', () => {
  const actual = jest.requireActual('react');
  const rt = { slots: [] as unknown[], idx: 0 };
  (globalThis as unknown as { __hooks: typeof rt }).__hooks = rt;
  const slot = <T,>(init: () => T): [number, T] => {
    const i = rt.idx++;
    if (!(i in rt.slots)) rt.slots[i] = init();
    return [i, rt.slots[i] as T];
  };
  return {
    ...actual,
    useState: (init: unknown) => {
      const [i, v] = slot(() => (typeof init === 'function' ? (init as () => unknown)() : init));
      return [v, (n: unknown) => void (rt.slots[i] = typeof n === 'function' ? (n as (p: unknown) => unknown)(rt.slots[i]) : n)];
    },
    useRef: (init: unknown) => slot(() => ({ current: init }))[1],
    useCallback: (fn: unknown) => fn,
    useMemo: (fn: () => unknown) => fn(),
    useEffect: () => undefined,
  };
});

const mockApiJson = jest.fn();
jest.mock('@/lib/api-client', () => {
  class ApiError extends Error {
    constructor(public status: number, public data: unknown) {
      super(`Request failed with status code ${status}`); // same shape as lib/api-client's ApiError
    }
  }
  return { ApiError, apiJson: (...a: unknown[]) => mockApiJson(...a) };
});

const seen: { opts: { fetcher: () => Promise<Row[]>; summary: boolean } | null; refresh: jest.Mock; mutate: Record<string, jest.Mock>; plans: Row[] } = {
  opts: null,
  refresh: jest.fn(async () => {}),
  mutate: {},
  plans: [],
};
jest.mock('../useFlightPlans', () => ({
  useFlightPlans: (opts: { fetcher: () => Promise<Row[]>; summary: boolean }) => {
    seen.opts = opts;
    return { flightPlans: seen.plans, refresh: seen.refresh, loading: false, error: null, ...seen.mutate };
  },
}));

import { ApiError } from '@/lib/api-client';
import { folderKey, NO_FOLDER_KEY, PLANS_PER_PAGE, SEARCH_KEY, useFolderPlans } from '../useFolderPlans';

interface Row {
  id: number;
  folderId: number | null;
  customName: string;
  authorizationStatus?: string;
  hasFileContent?: boolean;
  hasUplan?: boolean;
  fileContent?: unknown;
  uplan?: unknown;
}

// ---- fake server --------------------------------------------------------------------------------

let plans: Row[] = [];
let deletedFolders = new Set<number>();
const requests: string[] = [];
let failPages = false;
let legacyDetail = false; // the detail route of an older server: the full row even with ?fields=summary

const mkPlans = (folderId: number | null, n: number, startId: number, name = 'plan'): Row[] =>
  Array.from({ length: n }, (_, i) => ({ id: startId + i, folderId, customName: `${name} ${startId + i}`, authorizationStatus: 'sin autorización', hasFileContent: true, hasUplan: false }));

mockApiJson.mockImplementation(async (url: string) => {
  requests.push(url);
  const u = new URL(url, 'http://x');
  if (u.pathname === '/api/flightPlans') {
    if (failPages) throw new ApiError(500, null);
    const limit = Number(u.searchParams.get('limit'));
    const offset = Number(u.searchParams.get('offset'));
    const folderId = u.searchParams.get('folderId');
    const q = u.searchParams.get('q');
    const status = u.searchParams.get('authorizationStatus');
    if (folderId && folderId !== 'none' && deletedFolders.has(Number(folderId))) throw new ApiError(404, null);
    let rows = [...plans].sort((a, b) => b.id - a.id);
    if (folderId) rows = rows.filter((p) => (folderId === 'none' ? p.folderId === null : p.folderId === Number(folderId)));
    if (q) rows = rows.filter((p) => p.customName.toLowerCase().includes(q.toLowerCase()));
    if (status) rows = rows.filter((p) => p.authorizationStatus === status);
    return { items: rows.slice(offset, offset + limit), total: rows.length };
  }
  const m = u.pathname.match(/^\/api\/flightPlans\/(\d+)$/);
  if (m) {
    const p = plans.find((x) => x.id === Number(m[1]));
    if (!p) throw new ApiError(404, null);
    if (u.searchParams.get('fields') === 'summary' && !legacyDetail) return { ...p }; // the light row, flags from the server
    // the full detail row, heavy columns included
    const { hasFileContent, hasUplan, ...rest } = p;
    void hasFileContent;
    void hasUplan;
    return { ...rest, fileContent: '{"mission":{}}', uplan: '{"operationVolumes":[]}', activationMessage: 'long' };
  }
  throw new Error(`unexpected request ${url}`);
});

// ---- helpers ------------------------------------------------------------------------------------

/** The hook on the mini runtime: `api()` is the result of the LAST render, `rerender()` runs the hook again (new state / rows). */
function mountLive(selectedId: number | null = null, onCountsStale?: () => void) {
  const rt = (globalThis as unknown as { __hooks: { slots: unknown[]; idx: number } }).__hooks;
  rt.slots.length = 0;
  const props = { selectedId, onCountsStale };
  let api!: ReturnType<typeof useFolderPlans>;
  const render = () => {
    rt.idx = 0;
    // eslint-disable-next-line react-hooks/rules-of-hooks -- this IS the hook harness: a render function over the mini runtime
    api = useFolderPlans(props);
  };
  render();
  return { api: () => api, rerender: render };
}
type Live = ReturnType<typeof mountLive>;
const mount = (selectedId: number | null = null, onCountsStale?: () => void) => mountLive(selectedId, onCountsStale).api();
/** One refresh as the poll runs it: load, publish the rows (what useFlightPlans would hand back), render again. */
async function settle(h: Live): Promise<Row[]> {
  const rows = await loadAll();
  seen.plans = rows;
  h.rerender();
  return rows;
}
const byIdRequests = () => requests.filter((r) => /^\/api\/flightPlans\/\d+(\?|$)/.test(r));
const loadAll = () => seen.opts!.fetcher();
const pageRequests = () => requests.filter((r) => r.startsWith('/api/flightPlans?'));
const params = (url: string) => Object.fromEntries(new URL(url, 'http://x').searchParams);

beforeEach(() => {
  jest.clearAllMocks();
  requests.length = 0;
  deletedFolders = new Set();
  failPages = false;
  legacyDetail = false;
  seen.plans = [];
  seen.opts = null;
  seen.refresh.mockImplementation(async () => {});
  seen.mutate = {};
  plans = [...mkPlans(1, 120, 1000, 'big'), ...mkPlans(2, 3, 2000, 'small'), ...mkPlans(null, 4, 3000, 'loose')];
});

describe('useFolderPlans: what a refresh loads', () => {
  it('nothing is on screen until a group opens: no request at all', async () => {
    mount();
    expect(await loadAll()).toEqual([]);
    expect(requests).toEqual([]);
  });

  it('is a summary list over the paging fetcher', () => {
    mount();
    expect(seen.opts?.summary).toBe(true);
    expect(typeof seen.opts?.fetcher).toBe('function');
  });

  it('opening a folder loads its first 25 rows, newest first, and asks for a refresh', async () => {
    const api = mount();
    api.open('1');
    expect(seen.refresh).toHaveBeenCalledTimes(1);
    const rows = await loadAll();
    expect(pageRequests()).toHaveLength(1);
    expect(params(pageRequests()[0])).toEqual({ fields: 'summary', limit: String(PLANS_PER_PAGE), offset: '0', folderId: '1' });
    expect(rows.map((r) => r.id)).toEqual(Array.from({ length: 25 }, (_, i) => 1119 - i));
  });

  it('the plans without folder are group "none" and use folderId=none', async () => {
    const api = mount();
    api.open(NO_FOLDER_KEY);
    const rows = await loadAll();
    expect(params(pageRequests()[0]).folderId).toBe('none');
    expect(rows.map((r) => r.id)).toEqual([3003, 3002, 3001, 3000]);
  });

  it('opening an already open group does nothing; two groups are two requests, never a request for a closed one', async () => {
    const api = mount();
    api.open('1');
    api.open('1');
    expect(seen.refresh).toHaveBeenCalledTimes(1);
    api.open('2');
    await loadAll();
    expect(pageRequests().map((r) => params(r).folderId).sort()).toEqual(['1', '2']);
    requests.length = 0;
    api.close('2');
    await loadAll();
    expect(pageRequests().map((r) => params(r).folderId)).toEqual(['1']);
  });

  it('toggle opens a closed group and closes an open one', async () => {
    const api = mount();
    api.toggle('2');
    expect((await loadAll()).length).toBe(3);
    api.toggle('2');
    requests.length = 0;
    expect(await loadAll()).toEqual([]);
    expect(requests).toEqual([]);
  });
});

describe('useFolderPlans: show more', () => {
  it('"more" asks for the next 25 as the first 50 rows of the group (the refresh re-reads what is on screen)', async () => {
    const api = mount();
    api.open('1');
    api.more('1');
    const rows = await loadAll();
    expect(pageRequests()).toHaveLength(1);
    expect(params(pageRequests()[0]).limit).toBe('50');
    expect(rows).toHaveLength(50);
    expect(new Set(rows.map((r) => r.id)).size).toBe(50); // no repeats
  });

  it('more than the server cap (100) is fetched in chunks: 125 rows = limit 100 at offset 0, then limit 25 at offset 100', async () => {
    const api = mount();
    api.open('1');
    for (let i = 0; i < 4; i++) api.more('1'); // 25 + 4 * 25 = 125
    const rows = await loadAll();
    expect(pageRequests().map((r) => [params(r).offset, params(r).limit])).toEqual([['0', '100'], ['100', '25']]);
    expect(rows).toHaveLength(120); // 125 wanted, the group only has 120
  });

  it('stops asking as soon as a page comes back short (the group has fewer rows than wanted)', async () => {
    const api = mount();
    api.open('2'); // 3 rows, 25 wanted
    for (let i = 0; i < 8; i++) api.more('2'); // 225 wanted
    await loadAll();
    expect(pageRequests()).toHaveLength(1);
  });

  it('"more" on a group that is not open opens it with one extra page', async () => {
    const api = mount();
    api.more('1');
    await loadAll();
    expect(params(pageRequests()[0]).limit).toBe(String(PLANS_PER_PAGE));
  });
});

describe('useFolderPlans: server-side search', () => {
  it('a name search replaces the folder groups: only the q request is made, across folders (no folderId)', async () => {
    const api = mount();
    api.open('1');
    api.open('2');
    api.setQuery('small');
    const rows = await loadAll();
    expect(pageRequests()).toHaveLength(1);
    expect(params(pageRequests()[0])).toEqual({ fields: 'summary', limit: String(PLANS_PER_PAGE), offset: '0', q: 'small' });
    expect(rows.map((r) => r.id)).toEqual([2002, 2001, 2000]);
  });

  it('the text is trimmed and an unchanged query does not reload', () => {
    const api = mount();
    api.setQuery('  small ');
    expect(seen.refresh).toHaveBeenCalledTimes(1);
    api.setQuery('small');
    api.setQuery(' small');
    expect(seen.refresh).toHaveBeenCalledTimes(1);
    api.setQuery('smal');
    expect(seen.refresh).toHaveBeenCalledTimes(2);
  });

  it('clearing the search brings the open folders back', async () => {
    const api = mount();
    api.open('2');
    api.setQuery('loose');
    await loadAll();
    requests.length = 0;
    api.setQuery('');
    const rows = await loadAll();
    expect(pageRequests().map((r) => params(r).folderId)).toEqual(['2']);
    expect(rows).toHaveLength(3);
  });

  it('"more" works on the results (SEARCH_KEY): 50 rows of the search', async () => {
    const api = mount();
    api.setQuery('big');
    api.more(SEARCH_KEY);
    const rows = await loadAll();
    expect(params(pageRequests()[0])).toMatchObject({ q: 'big', limit: '50' });
    expect(rows).toHaveLength(50);
  });

  it('a search with no match publishes no rows and is not an error', async () => {
    const api = mount();
    api.setQuery('nothing like this');
    expect(await loadAll()).toEqual([]);
  });
});

describe('useFolderPlans: the selected plan', () => {
  it('a plan that is on a loaded page costs no extra request', async () => {
    const api = mount(1119);
    api.open('1');
    await loadAll();
    expect(byIdRequests()).toEqual([]);
  });

  it('a plan on no loaded page (deep link ?selectPlan=) is fetched by id with ?fields=summary, published as a LIGHT row, and its folder opens', async () => {
    mount(1005); // folder 1 has 120 rows: 1005 is on page 5
    const rows = await loadAll();
    expect(byIdRequests()).toEqual(['/api/flightPlans/1005?fields=summary']);
    expect(requests).not.toContain('/api/flightPlans/1005'); // never the full row (fileContent + uplan)
    const sel = rows.find((r) => r.id === 1005)!;
    expect(sel).toBeDefined();
    expect(sel).not.toHaveProperty('fileContent');
    expect(sel).not.toHaveProperty('uplan');
    expect(sel).not.toHaveProperty('activationMessage');
    expect([sel.hasFileContent, sel.hasUplan]).toEqual([true, false]); // as the server said (the fake plan has a file and no U-plan)
    // its group is open now: the same refresh loaded the first page of folder 1 too
    expect(pageRequests().map((r) => params(r).folderId)).toContain('1');
    expect(rows.length).toBe(26); // 25 of the group + the selected one (not on the first page)
  });

  it('the selected plan is read ONCE per refresh even though the refresh repeats itself when its group opens; the next refresh reads it once again', async () => {
    mount(1005);
    await loadAll();
    expect(byIdRequests()).toHaveLength(1); // was 2 before the fix: once before the group opened, once after
    requests.length = 0;
    await loadAll(); // the group is open now, the plan is still on no loaded page
    expect(byIdRequests()).toEqual(['/api/flightPlans/1005?fields=summary']);
  });

  it('the flags of the light row are the server\'s: a plan without file keeps hasFileContent false', async () => {
    plans.find((p) => p.id === 1005)!.hasFileContent = false;
    mount(1005);
    const rows = await loadAll();
    expect(rows.find((r) => r.id === 1005)?.hasFileContent).toBe(false);
  });

  it('an older server that ignores ?fields=summary and sends the full row: still published light, flags from the heavy columns', async () => {
    legacyDetail = true;
    mount(1005);
    const sel = (await loadAll()).find((r) => r.id === 1005)!;
    expect(sel).not.toHaveProperty('fileContent');
    expect(sel).not.toHaveProperty('uplan');
    expect(sel).not.toHaveProperty('activationMessage');
    expect([sel.hasFileContent, sel.hasUplan]).toEqual([true, true]);
  });

  it('after the group opened, the next refresh no longer needs the by-id request when the plan is on a loaded page', async () => {
    const api = mount(1119); // newest of folder 1: first page
    void api;
    await loadAll();
    requests.length = 0;
    await loadAll();
    expect(byIdRequests()).toEqual([]);
  });

  it('a plan that does not exist (404) or is not the caller\'s (403) is not an error: the refresh still resolves', async () => {
    mount(999999);
    await expect(loadAll()).resolves.toEqual([]);
    mockApiJson.mockImplementationOnce(async () => {
      throw new ApiError(403, null);
    });
    await expect(loadAll()).resolves.toEqual([]);
  });

  it('any other failure of the by-id request is an error (the poll retries, the list does not claim "missing")', async () => {
    mount(1005); // nothing is open yet: the first request of the run is the by-id one
    mockApiJson.mockImplementationOnce(async () => {
      throw new ApiError(500, null);
    });
    await expect(loadAll()).rejects.toMatchObject({ status: 500 });
  });
});

describe('useFolderPlans: errors', () => {
  it('a folder that was deleted (404) leaves the screen silently and is not asked for again', async () => {
    const api = mount();
    api.open('1');
    api.open('2');
    deletedFolders.add(2);
    const rows = await loadAll();
    expect(rows).toHaveLength(25); // folder 1 only
    requests.length = 0;
    await loadAll();
    expect(pageRequests().map((r) => params(r).folderId)).toEqual(['1']);
  });

  it('a 404 on the search is NOT swallowed as "folder deleted" (the key stays)', async () => {
    const api = mount();
    api.setQuery('x');
    mockApiJson.mockImplementationOnce(async () => {
      throw new ApiError(404, null);
    });
    await expect(loadAll()).rejects.toMatchObject({ status: 404 });
  });

  it('a server error propagates so the poll can back off', async () => {
    const api = mount();
    api.open('1');
    failPages = true;
    await expect(loadAll()).rejects.toMatchObject({ status: 500 });
  });
});

describe('useFolderPlans: folder delete needs the approved ids of ALL pages', () => {
  it('approvedIdsOf pages through the server with authorizationStatus=aprobado until a short page', async () => {
    plans.forEach((p) => {
      if (p.folderId === 1 && p.id % 2 === 0) p.authorizationStatus = 'aprobado'; // 60 approved of 120
    });
    const api = mount();
    const ids = await api.approvedIdsOf(1);
    expect(ids).toHaveLength(60);
    expect(ids.every((id) => id % 2 === 0 && id >= 1000 && id < 1120)).toBe(true);
    for (const r of pageRequests()) expect(params(r)).toMatchObject({ folderId: '1', authorizationStatus: 'aprobado', limit: '100' });
  });

  it('exactly 100 approved: asks again (a full page may have a next one) and stops on the empty page', async () => {
    plans.forEach((p) => {
      if (p.folderId === 1) p.authorizationStatus = 'aprobado';
    });
    plans = plans.filter((p) => p.folderId !== 1 || p.id < 1100); // 100 plans, all approved
    const api = mount();
    expect(await api.approvedIdsOf(1)).toHaveLength(100);
    expect(pageRequests().map((r) => params(r).offset)).toEqual(['0', '100']);
  });

  it('a folder without approved plans -> [] with one request', async () => {
    const api = mount();
    expect(await api.approvedIdsOf(2)).toEqual([]);
    expect(pageRequests()).toHaveLength(1);
  });

  it('a failure rejects (the caller must not delete the folder without telling FAS)', async () => {
    const api = mount();
    failPages = true;
    await expect(api.approvedIdsOf(1)).rejects.toMatchObject({ status: 500 });
  });
});

describe('useFolderPlans: mutations that change a folder count refresh the counts', () => {
  const names = ['createFlightPlan', 'createFlightPlans', 'deleteFlightPlan', 'deleteFlightPlans', 'moveFlightPlan', 'importExternalUplan'] as const;

  it.each(names)('%s calls onCountsStale after the mutation and passes its result through', async (name) => {
    const order: string[] = [];
    seen.mutate = Object.fromEntries(names.map((n) => [n, jest.fn(async () => (order.push(n), `${n}-result`))]));
    const stale = jest.fn(() => order.push('stale'));
    const api = mount(null, stale);
    const fn = api.fp[name] as unknown as (...a: unknown[]) => Promise<unknown>;
    expect(await fn(1, 2)).toBe(`${name}-result`);
    expect(order).toEqual([name, 'stale']);
    expect(seen.mutate[name]).toHaveBeenCalledWith(1, 2);
  });

  it('a failing mutation does not refresh the counts (nothing changed)', async () => {
    seen.mutate = { deleteFlightPlan: jest.fn(async () => Promise.reject(new Error('boom'))) };
    const stale = jest.fn();
    const api = mount(null, stale);
    await expect(api.fp.deleteFlightPlan(5)).rejects.toThrow('boom');
    expect(stale).not.toHaveBeenCalled();
  });

  it('works without a counts callback', async () => {
    seen.mutate = { deleteFlightPlan: jest.fn(async () => true) };
    const api = mount();
    await expect(api.fp.deleteFlightPlan(5)).resolves.toBe(true);
  });
});

describe('group keys', () => {
  it('folderKey: the folder id as text, "none" for no folder', () => {
    expect(folderKey(12)).toBe('12');
    expect(folderKey(null)).toBe(NO_FOLDER_KEY);
    expect(NO_FOLDER_KEY).toBe('none');
    expect(PLANS_PER_PAGE).toBe(25);
  });

  it('the search key cannot collide with a folder key', () => {
    expect(SEARCH_KEY).not.toBe(NO_FOLDER_KEY);
    expect(Number.isNaN(Number(SEARCH_KEY))).toBe(true);
  });
});

describe('useFolderPlans: what the list shows (rowsOf / totalOf / loadedOf / openKeys)', () => {
  const ids = (rows: { id: number }[]) => rows.map((r) => r.id);
  const newest = (n: number, from = 1119) => Array.from({ length: n }, (_, i) => from - i);

  it('an open group lists its loaded page newest first, with the server total and the loaded count', async () => {
    const h = mountLive();
    h.api().open('1');
    await settle(h);
    expect(ids(h.api().rowsOf('1'))).toEqual(newest(25));
    expect(h.api().totalOf('1')).toBe(120);
    expect(h.api().loadedOf('1')).toBe(25);
    expect(h.api().openKeys.has('1')).toBe(true);
  });

  it('a group that was never opened lists nothing and has no total yet', async () => {
    const h = mountLive();
    h.api().open('1');
    await settle(h);
    expect(h.api().rowsOf('2')).toEqual([]);
    expect(h.api().totalOf('2')).toBeUndefined();
    expect(h.api().loadedOf('2')).toBe(0);
    expect(h.api().openKeys.has('2')).toBe(false);
  });

  it('"show more" grows the group: 50 rows, still no repeats, loadedOf follows', async () => {
    const h = mountLive();
    h.api().open('1');
    h.api().more('1');
    await settle(h);
    expect(ids(h.api().rowsOf('1'))).toEqual(newest(50));
    expect(h.api().loadedOf('1')).toBe(50);
  });

  describe('the selected plan is on no loaded page (deep link ?selectPlan=1005, page 5 of folder 1)', () => {
    it('its row is PINNED at the top of its own group, and its group is open', async () => {
      const h = mountLive(1005);
      await settle(h);
      expect(h.api().openKeys.has('1')).toBe(true);
      const rows = ids(h.api().rowsOf('1'));
      expect(rows[0]).toBe(1005);
      expect(rows.slice(1)).toEqual(newest(25));
      expect(rows).toHaveLength(26);
    });

    it('the pinned row is not counted as loaded: "Show more (N left)" = total - loadedOf stays 95', async () => {
      const h = mountLive(1005);
      await settle(h);
      expect(h.api().loadedOf('1')).toBe(25);
      expect((h.api().totalOf('1') ?? 0) - h.api().loadedOf('1')).toBe(95);
    });

    it('it is pinned only in its own folder, never in another group', async () => {
      const h = mountLive(1005);
      h.api().open('2');
      await settle(h);
      expect(ids(h.api().rowsOf('2'))).toEqual([2002, 2001, 2000]);
      expect(ids(h.api().rowsOf('1'))).toContain(1005);
    });

    it('it is not pinned into the search results (they show what matches)', async () => {
      const h = mountLive(1005);
      h.api().setQuery('small');
      await settle(h);
      expect(h.api().search).toEqual({ text: 'small' });
      expect(ids(h.api().rowsOf(SEARCH_KEY))).toEqual([2002, 2001, 2000]);
      expect(h.api().totalOf(SEARCH_KEY)).toBe(3);
    });

    it('once "show more" reaches it, it sits in its natural place: no pin, no duplicate', async () => {
      const h = mountLive(1005);
      await settle(h);
      for (let i = 0; i < 4; i++) h.api().more('1'); // 25 + 100 = 125 wanted, the folder has 120
      await settle(h);
      const rows = ids(h.api().rowsOf('1'));
      expect(rows).toHaveLength(120);
      expect(new Set(rows).size).toBe(120);
      expect(rows[114]).toBe(1005); // 1119 - 1005
      expect(h.api().loadedOf('1')).toBe(120);
    });

    it('selectedMissing stays false for a plan that exists', async () => {
      const h = mountLive(1005);
      await settle(h);
      expect(h.api().selectedMissing).toBe(false);
    });
  });

  it('a selected plan on the first page is neither pinned nor repeated', async () => {
    const h = mountLive(1119);
    await settle(h);
    const rows = ids(h.api().rowsOf('1'));
    expect(rows).toEqual(newest(25));
    expect(rows.filter((id) => id === 1119)).toHaveLength(1);
  });

  it('a selected plan without a folder is pinned at the top of the "none" group only when its page does not reach it', async () => {
    plans.push(...mkPlans(null, 30, 4000, 'many')); // 34 loose plans: 25 on the first page
    const h = mountLive(3000); // the oldest of them (3000 < 3001..3003 < 4000..4029)
    await settle(h);
    const rows = ids(h.api().rowsOf(NO_FOLDER_KEY));
    expect(rows[0]).toBe(3000);
    expect(rows).toHaveLength(26);
  });

  it('a selected plan that does not exist is "missing" (the URL can be cleaned), and the list is not an error', async () => {
    const h = mountLive(999999);
    await expect(settle(h)).resolves.toEqual([]);
    expect(h.api().selectedMissing).toBe(true);
  });

  it('closing a group drops its rows; the search brings its own list and clearing it brings the groups back', async () => {
    const h = mountLive();
    h.api().open('2');
    await settle(h);
    expect(h.api().rowsOf('2')).toHaveLength(3);
    h.api().close('2');
    h.rerender();
    expect(h.api().rowsOf('2')).toEqual([]);
    expect(h.api().openKeys.has('2')).toBe(false);
    h.api().open('2');
    await settle(h);
    h.api().setQuery('big');
    await settle(h);
    expect(h.api().search).toEqual({ text: 'big' });
    h.api().setQuery('');
    await settle(h);
    expect(h.api().search).toBeNull();
    expect(h.api().rowsOf('2')).toHaveLength(3);
  });
});
