import { fakeBrowser } from '@webext-core/fake-browser';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ext } from '../../src/shared/ext';
import { json, status, stubFetch } from '../helpers/fetch';

type Wikidata = typeof import('../../src/content/wikidata');
let categoriesOf: Wikidata['categoriesOf'];
let categoriesOfMany: Wikidata['categoriesOfMany'];

const NOW = new Date('2026-10-16T10:00:00Z');
const KEY = 'wikidataCache';

beforeEach(async () => {
  fakeBrowser.reset();
  vi.resetModules();
  vi.spyOn(ext.runtime, 'getManifest').mockReturnValue({
    version: '1.2.3',
  } as chrome.runtime.Manifest);
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(NOW);
  ({ categoriesOf, categoriesOfMany } = await import('../../src/content/wikidata'));
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

const row = (title: string, qid: string, cat: string | null = 'Q5', label = 'être humain') => ({
  title: { value: title },
  item: { value: `http://www.wikidata.org/entity/${qid}` },
  ...(cat && {
    cat: { value: `http://www.wikidata.org/entity/${cat}` },
    catLabel: { value: label },
    prop: { value: 'P31' },
  }),
});
const sparql = (...bindings: unknown[]) => json({ results: { bindings } });
const human = { id: 'Q5', label: 'être humain', prop: 'P31' };
const stored = async () =>
  ((await ext.storage.local.get(KEY))[KEY] as { entries: Record<string, unknown> }).entries;
const query = (url: URL) => url.searchParams.get('query')!;
const asked = (url: URL) => [...query(url).matchAll(/"((?:[^"\\]|\\.)*)"@fr/g)].map((m) => m[1]!);
// answers every asked title with one human row
const echo = (url: URL) => sparql(...asked(url).map((title, i) => row(title, `Q${i + 1}`)));

describe('categoriesOfMany', () => {
  it('serves fresh cache hits without a request', async () => {
    await ext.storage.local.set({
      [KEY]: { version: 1, entries: { A: { qid: 'Q1', cats: [human], at: NOW.getTime() } } },
    });
    const { calls } = stubFetch(echo);

    const result = await categoriesOfMany(['A', 'B']);

    expect(result.get('A')).toEqual({ qid: 'Q1', cats: [human] });
    expect(asked(calls[0]!.url)).toEqual(['B']);
    expect(calls).toHaveLength(1);
  });

  it('sends no request when everything is cached', async () => {
    await ext.storage.local.set({
      [KEY]: { version: 1, entries: { A: { qid: 'Q1', cats: [human], at: NOW.getTime() } } },
    });
    const { calls } = stubFetch(echo);

    expect((await categoriesOfMany(['A'])).size).toBe(1);
    expect(calls).toHaveLength(0);
  });

  it('splits 120 titles into 3 requests of at most 50', async () => {
    const titles = Array.from({ length: 120 }, (_, i) => `T${i}`);
    const { calls } = stubFetch(echo);

    const result = await categoriesOfMany(titles);

    expect(calls.map((call) => asked(call.url).length)).toEqual([50, 50, 20]);
    expect(result.size).toBe(120);
    expect(Object.keys(await stored())).toHaveLength(120);
  });

  it('splits a batch whose URL would be too long', async () => {
    const titles = Array.from({ length: 50 }, (_, i) => `${'é'.repeat(40)}${i}`);
    const { calls } = stubFetch(echo);

    const result = await categoriesOfMany(titles);

    expect(calls.length).toBeGreaterThan(1);
    expect(calls.every((call) => call.url.href.length <= 7_000)).toBe(true);
    expect(calls.flatMap((call) => asked(call.url))).toEqual(titles);
    expect(result.size).toBe(50);
  });

  it('maps rows back to titles, quotes included', async () => {
    const tricky = 'Le "Roi" \\ Lion';
    const { calls } = stubFetch(
      sparql(
        row(tricky, 'Q1', 'Q5', 'être humain'),
        row('B', 'Q2', 'Q7', 'autre'),
        row('B', 'Q2', 'Q5', 'être humain'),
      ),
    );

    const result = await categoriesOfMany([tricky, 'B']);

    expect(query(calls[0]!.url)).toContain('"Le \\"Roi\\" \\\\ Lion"@fr "B"@fr');
    expect(result.get(tricky)).toEqual({ qid: 'Q1', cats: [human] });
    expect(result.get('B')?.cats.map((cat) => cat.id)).toEqual(['Q7', 'Q5']);
  });

  it('caches an absent title as missing', async () => {
    const { calls } = stubFetch(sparql(row('A', 'Q1')));

    const result = await categoriesOfMany(['A', 'B']);

    expect(result.get('B')).toEqual({ qid: null, cats: [] });
    expect((await stored()).B).toEqual({ qid: null, cats: [], at: NOW.getTime() });
    await categoriesOfMany(['B']);
    expect(calls).toHaveLength(1);
  });

  it('treats a disambiguation page and an item without category as no category', async () => {
    stubFetch(sparql(row('A', 'Q1', 'Q4167410', 'homonymie'), row('B', 'Q2', null)));

    const result = await categoriesOfMany(['A', 'B']);

    expect(result.get('A')).toEqual({ qid: null, cats: [] });
    expect(result.get('B')).toEqual({ qid: null, cats: [] });
  });

  it('leaves a failed batch absent and uncached, then retries', async () => {
    const { calls } = stubFetch(status(503), echo);

    expect((await categoriesOfMany(['A'])).size).toBe(0);
    expect(await stored().catch(() => ({}))).toEqual({});
    expect((await categoriesOfMany(['A'])).size).toBe(1);
    expect(calls).toHaveLength(2);
  });

  it('does not fall back to the Action API', async () => {
    const { calls } = stubFetch(new TypeError('offline'));

    await categoriesOfMany(['A']);

    expect(calls.map((call) => call.url.hostname)).toEqual(['query.wikidata.org']);
  });

  it('keeps the batches that worked when a later one fails', async () => {
    const titles = Array.from({ length: 60 }, (_, i) => `T${i}`);
    stubFetch(echo, status(400));

    const result = await categoriesOfMany(titles);

    expect(result.size).toBe(50);
  });

  it('pauses both single and batch requests on a 429', async () => {
    const { calls } = stubFetch(status(429, { 'Retry-After': '30' }));

    expect((await categoriesOfMany(['A'])).size).toBe(0);
    expect(calls).toHaveLength(1);

    expect((await categoriesOfMany(['B'])).size).toBe(0);
    expect(await categoriesOf('C')).toBeNull();
    expect(calls).toHaveLength(1);

    vi.setSystemTime(new Date(NOW.getTime() + 30_000));
    stubFetch(echo);
    expect((await categoriesOfMany(['B'])).size).toBe(1);
  });

  it('stops the remaining batches of a 429', async () => {
    const titles = Array.from({ length: 120 }, (_, i) => `T${i}`);
    const { calls } = stubFetch(status(429, { 'Retry-After': '30' }));

    await categoriesOfMany(titles);

    expect(calls).toHaveLength(1);
  });

  it('is paused by a 429 on a single request', async () => {
    const { calls } = stubFetch(status(429, { 'Retry-After': '30' }));
    expect(await categoriesOf('A')).toBeNull();
    const sent = calls.length;

    expect((await categoriesOfMany(['B'])).size).toBe(0);
    expect(calls).toHaveLength(sent);
  });

  it('stops the remaining batches on abort, the running one fills the cache', async () => {
    const controller = new AbortController();
    const titles = Array.from({ length: 120 }, (_, i) => `T${i}`);
    let release!: () => void;
    const { calls } = stubFetch(
      (url) =>
        new Promise<Response>((resolve) => {
          release = () => resolve(echo(url));
        }),
    );

    const pending = categoriesOfMany(titles, controller.signal);
    await vi.waitFor(() => expect(calls).toHaveLength(1));
    controller.abort();
    await expect(pending).rejects.toMatchObject({ name: 'AbortError' });
    release();

    await vi.waitFor(async () => expect(Object.keys(await stored())).toHaveLength(50));
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(calls).toHaveLength(1);
  });

  it('rejects at once when the signal is already aborted', async () => {
    const { calls } = stubFetch(echo);

    await expect(categoriesOfMany(['A'], AbortSignal.abort())).rejects.toMatchObject({
      name: 'AbortError',
    });
    expect(calls).toHaveLength(0);
  });

  it('serves a single request between two pending batches', async () => {
    const titles = Array.from({ length: 120 }, (_, i) => `T${i}`);
    const order: string[] = [];
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    stubFetch(async (url) => {
      const list = asked(url);
      order.push(list.length === 1 ? `single ${list[0]}` : `batch ${list.length}`);
      if (order.length === 1) await gate;
      return echo(url);
    });

    const many = categoriesOfMany(titles);
    await vi.waitFor(() => expect(order).toHaveLength(1));
    const single = categoriesOf('Solo');
    release();
    await Promise.all([many, single]);

    expect(order).toEqual(['batch 50', 'single Solo', 'batch 50', 'batch 20']);
  });
});
