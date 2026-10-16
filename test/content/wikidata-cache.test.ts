import { fakeBrowser } from '@webext-core/fake-browser';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ext } from '../../src/shared/ext';
import { json, status, stubFetch } from '../helpers/fetch';

type Wikidata = typeof import('../../src/content/wikidata');
let categoriesOf: Wikidata['categoriesOf'];

const DAY = 24 * 60 * 60 * 1000;
const NOW = new Date('2026-10-16T10:00:00Z');
const KEY = 'wikidataCache';

// module state (pause, in-flight) must not leak between tests
beforeEach(async () => {
  fakeBrowser.reset();
  vi.resetModules();
  vi.spyOn(ext.runtime, 'getManifest').mockReturnValue({
    version: '1.2.3',
  } as chrome.runtime.Manifest);
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(NOW);
  ({ categoriesOf } = await import('../../src/content/wikidata'));
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

const binding = (qid: string, cat: string | null, label = 'x', prop = 'P31') => ({
  item: { value: `http://www.wikidata.org/entity/${qid}` },
  ...(cat && {
    cat: { value: `http://www.wikidata.org/entity/${cat}` },
    catLabel: { value: label },
    prop: { value: prop },
  }),
});
const sparql = (...bindings: unknown[]) => json({ results: { bindings } });
const human = () => sparql(binding('Q937', 'Q5', 'être humain'));
const cats = [{ id: 'Q5', label: 'être humain', prop: 'P31' }];
const stored = async () => ((await ext.storage.local.get(KEY))[KEY] as { entries: object }).entries;
const seed = (entries: object, version = 1) =>
  ext.storage.local.set({ [KEY]: { version, entries } });

const hang = (_url: URL, init: RequestInit) =>
  new Promise<Response>((_resolve, reject) => {
    init.signal!.addEventListener('abort', () => reject(init.signal!.reason as Error));
  });

describe('cache', () => {
  it('stores a success and serves it without fetching', async () => {
    const { calls } = stubFetch(human());

    expect(await categoriesOf('Einstein')).toEqual({ qid: 'Q937', cats });
    expect(await categoriesOf('Einstein')).toEqual({ qid: 'Q937', cats });

    expect(calls).toHaveLength(1);
    expect(await stored()).toEqual({ Einstein: { qid: 'Q937', cats, at: NOW.getTime() } });
  });

  it('serves an entry younger than 30 days', async () => {
    await seed({ A: { qid: 'Q1', cats, at: NOW.getTime() - 29 * DAY } });
    const { calls } = stubFetch(human());

    expect(await categoriesOf('A')).toEqual({ qid: 'Q1', cats });
    expect(calls).toHaveLength(0);
  });

  it('refetches an entry older than 30 days', async () => {
    await seed({ A: { qid: 'Q1', cats: [], at: NOW.getTime() - 31 * DAY } });
    const { calls } = stubFetch(human());

    expect(await categoriesOf('A')).toEqual({ qid: 'Q937', cats });
    expect(calls).toHaveLength(1);
  });

  it('refetches a malformed entry', async () => {
    await seed({ A: { qid: 'Q1', cats: [{ id: 1 }], at: NOW.getTime() } });
    const { calls } = stubFetch(human());

    expect(await categoriesOf('A')).toEqual({ qid: 'Q937', cats });
    expect(calls).toHaveLength(1);
  });

  it('ignores a cache of an unknown version', async () => {
    await seed({ A: { qid: 'Q1', cats, at: NOW.getTime() } }, 2);
    const { calls } = stubFetch(human());

    expect(await categoriesOf('A')).toEqual({ qid: 'Q937', cats });
    expect(calls).toHaveLength(1);
  });

  it('caches a missing page as no category', async () => {
    const { calls } = stubFetch(sparql());

    expect(await categoriesOf('Inconnu')).toEqual({ qid: null, cats: [] });
    expect(await categoriesOf('Inconnu')).toEqual({ qid: null, cats: [] });
    expect(calls).toHaveLength(1);
  });

  it('caches an item without category as no category', async () => {
    const { calls } = stubFetch(sparql(binding('Q937', null)));

    expect(await categoriesOf('Rien')).toEqual({ qid: null, cats: [] });
    expect(await categoriesOf('Rien')).toEqual({ qid: null, cats: [] });
    expect(calls).toHaveLength(1);
  });

  it('caches a disambiguation page as no category', async () => {
    const { calls } = stubFetch(sparql(binding('Q1', 'Q4167410', 'page d’homonymie')));

    expect(await categoriesOf('Mercure')).toEqual({ qid: null, cats: [] });
    expect(await categoriesOf('Mercure')).toEqual({ qid: null, cats: [] });
    expect(calls).toHaveLength(1);
    expect(await stored()).toEqual({ Mercure: { qid: null, cats: [], at: NOW.getTime() } });
  });
});

describe('failures', () => {
  it('returns null on an error and does not cache it', async () => {
    const { calls } = stubFetch(status(400), human());

    expect(await categoriesOf('A')).toBeNull();
    expect(await categoriesOf('A')).toEqual({ qid: 'Q937', cats });
    expect(calls).toHaveLength(2);
  });

  it('does not cache a network error', async () => {
    const { calls } = stubFetch(new TypeError('offline'), new TypeError('offline'), human());

    expect(await categoriesOf('A')).toBeNull();
    expect(await categoriesOf('A')).toEqual({ qid: 'Q937', cats });
    expect(calls).toHaveLength(3);
  });

  it('does not cache a 503', async () => {
    const { calls } = stubFetch(status(503), status(503), human());

    expect(await categoriesOf('A')).toBeNull();
    expect(await categoriesOf('A')).toEqual({ qid: 'Q937', cats });
    expect(calls).toHaveLength(3);
  });

  it('does not cache a maxlag', async () => {
    const maxlag = (url: URL) =>
      url.hostname === 'query.wikidata.org' ? status(503) : json({ error: { code: 'maxlag' } });
    const { calls } = stubFetch(maxlag, maxlag, human());
    expect(await categoriesOf('A')).toBeNull();

    vi.setSystemTime(new Date(NOW.getTime() + 5000));
    expect(await categoriesOf('A')).toEqual({ qid: 'Q937', cats });
    expect(calls).toHaveLength(3);
  });

  it('pauses on a 429 until Retry-After, then resumes', async () => {
    const { calls } = stubFetch(status(429, { 'Retry-After': '30' }), status(500), human());
    expect(await categoriesOf('A')).toBeNull();
    // the 429 also triggers the fallback endpoint
    const sent = calls.length;

    expect(await categoriesOf('B')).toBeNull();
    expect(calls).toHaveLength(sent);

    vi.advanceTimersByTime(29_000);
    expect(await categoriesOf('B')).toBeNull();
    expect(calls).toHaveLength(sent);

    vi.advanceTimersByTime(1_000);
    stubFetch(human());
    expect(await categoriesOf('B')).toEqual({ qid: 'Q937', cats });
  });

  it('pauses 5 s on a 429 without Retry-After', async () => {
    const { calls } = stubFetch(status(429), status(429), human());
    expect(await categoriesOf('A')).toBeNull();
    const sent = calls.length;

    vi.advanceTimersByTime(4_000);
    expect(await categoriesOf('B')).toBeNull();
    expect(calls).toHaveLength(sent);

    vi.advanceTimersByTime(1_000);
    expect(await categoriesOf('B')).toEqual({ qid: 'Q937', cats });
  });

  it('does not pause on a 503 without Retry-After', async () => {
    const { calls } = stubFetch(status(503), status(503), human());
    expect(await categoriesOf('A')).toBeNull();

    expect(await categoriesOf('B')).toEqual({ qid: 'Q937', cats });
    expect(calls).toHaveLength(3);
  });

  it('serves the cache during a pause', async () => {
    await seed({ A: { qid: 'Q1', cats, at: NOW.getTime() } });
    stubFetch(status(429, { 'Retry-After': '30' }));
    expect(await categoriesOf('B')).toBeNull();

    expect(await categoriesOf('A')).toEqual({ qid: 'Q1', cats });
  });
});

describe('queue', () => {
  it('shares one fetch between concurrent calls for a title', async () => {
    const { calls } = stubFetch(human());

    const [first, second] = await Promise.all([categoriesOf('A'), categoriesOf('A')]);

    expect(first).toEqual({ qid: 'Q937', cats });
    expect(second).toEqual(first);
    expect(calls).toHaveLength(1);
  });

  it('runs one request at a time across titles', async () => {
    const events: string[] = [];
    stubFetch(async (url) => {
      const title = /"(\w)"@fr/.exec(url.searchParams.get('query')!)![1]!;
      events.push(`start ${title}`);
      await Promise.resolve();
      await Promise.resolve();
      events.push(`end ${title}`);
      return human();
    });

    await Promise.all([categoriesOf('A'), categoriesOf('B')]);

    expect(events).toEqual(['start A', 'end A', 'start B', 'end B']);
  });

  it('lets one caller abort without breaking the other', async () => {
    const controller = new AbortController();
    let release!: () => void;
    const { calls } = stubFetch(
      () =>
        new Promise<Response>((resolve) => {
          release = () => resolve(human());
        }),
    );

    const aborted = categoriesOf('A', controller.signal);
    const kept = categoriesOf('A');
    await vi.waitFor(() => expect(calls).toHaveLength(1));
    controller.abort();
    await expect(aborted).rejects.toMatchObject({ name: 'AbortError' });

    release();
    expect(await kept).toEqual({ qid: 'Q937', cats });
    expect(calls).toHaveLength(1);
    expect(calls[0]!.init.signal).not.toBe(controller.signal);
  });

  it('caches the result of a request whose only caller aborted', async () => {
    const controller = new AbortController();
    let release!: () => void;
    const { calls } = stubFetch(
      () =>
        new Promise<Response>((resolve) => {
          release = () => resolve(human());
        }),
    );

    const aborted = categoriesOf('A', controller.signal);
    await vi.waitFor(() => expect(calls).toHaveLength(1));
    controller.abort();
    await expect(aborted).rejects.toMatchObject({ name: 'AbortError' });
    release();

    await vi.waitFor(async () => expect(await stored()).toHaveProperty('A'));
  });

  it('rejects at once when the signal is already aborted', async () => {
    const { calls } = stubFetch(hang);

    await expect(categoriesOf('A', AbortSignal.abort())).rejects.toMatchObject({
      name: 'AbortError',
    });
    expect(calls).toHaveLength(0);
  });
});
