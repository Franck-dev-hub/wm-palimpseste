import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ext } from '../../src/shared/ext';
import { fetchCategories, sparqlLiteral } from '../../src/content/wikidata';
import { json, status, stubFetch } from '../helpers/fetch';

// the fake browser has no getManifest
beforeEach(() => {
  vi.spyOn(ext.runtime, 'getManifest').mockReturnValue({
    version: '1.2.3',
  } as chrome.runtime.Manifest);
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

const binding = (cat: string | null, label: string, prop: string) => ({
  item: { value: 'http://www.wikidata.org/entity/Q937' },
  ...(cat && {
    cat: { value: `http://www.wikidata.org/entity/${cat}` },
    catLabel: { value: label },
    prop: { value: prop },
  }),
});
const sparql = (...bindings: unknown[]) => json({ results: { bindings } });

const einstein = sparql(
  binding('Q5', 'être humain', 'P31'),
  binding('Q169470', 'physicien', 'P106'),
);
const cats = [
  { id: 'Q5', label: 'être humain', prop: 'P31' },
  { id: 'Q169470', label: 'physicien', prop: 'P106' },
];

const claims = (prop: string, ...ids: string[]) =>
  json({
    claims: {
      [prop]: ids.map((id) => ({ mainsnak: { datavalue: { value: { id } } }, rank: 'normal' })),
    },
  });

// Action API answers by action, SPARQL by host
const fallbackApi = (url: URL) => {
  if (url.hostname === 'query.wikidata.org') return status(503);
  const action = url.searchParams.get('action');
  if (action === 'wbgetclaims') {
    return url.searchParams.get('property') === 'P31'
      ? claims('P31', 'Q5')
      : claims('P106', 'Q169470');
  }
  if (url.searchParams.get('props') === 'labels') {
    return json({
      entities: {
        Q5: { labels: { fr: { value: 'être humain' }, en: { value: 'human' } } },
        Q169470: { labels: { fr: { value: 'physicien' }, en: { value: 'physicist' } } },
      },
    });
  }
  return json({ entities: { Q937: { id: 'Q937' } } });
};

describe('fetchCategories', () => {
  it('sends anonymous requests with the Api-User-Agent', async () => {
    const { calls } = stubFetch(einstein);

    await fetchCategories('Albert Einstein');

    const { url, init } = calls[0]!;
    expect(init.credentials).toBe('omit');
    expect(init.referrerPolicy).toBe('no-referrer');
    expect(init.headers).toEqual({
      'Api-User-Agent': `Palimpseste/1.2.3 (+https://github.com/Franck-dev-hub/wm-palimpseste)`,
    });
    expect(init.signal).toBeInstanceOf(AbortSignal);
    expect(url.origin + url.pathname).toBe('https://query.wikidata.org/sparql');
    expect(url.searchParams.get('format')).toBe('json');
    const query = url.searchParams.get('query')!;
    expect(query).toContain('schema:name "Albert Einstein"@fr');
    expect(query).toContain('schema:isPartOf <https://fr.wikipedia.org/>');
    expect(query).toContain('wdt:P31');
    expect(query).toContain('wdt:P106');
    expect(query).toContain('"fr,en"');
  });

  it('escapes the title in the SPARQL literal', async () => {
    const { calls } = stubFetch(einstein);

    await fetchCategories('A"B\\C\nD"@fr } #');

    const query = calls[0]!.url.searchParams.get('query')!;
    expect(query).toContain('schema:name "A\\"B\\\\C\\nD\\"@fr } #"@fr');
    expect(sparqlLiteral('\r\t')).toBe('\\r\\t');
  });

  it('returns the P31 and P106 categories from SPARQL', async () => {
    stubFetch(einstein);

    expect(await fetchCategories('Albert Einstein')).toEqual({ kind: 'found', qid: 'Q937', cats });
  });

  it('returns found with no categories for an item without P31 or P106', async () => {
    stubFetch(sparql(binding(null, '', '')));

    expect(await fetchCategories('Rien')).toEqual({ kind: 'found', qid: 'Q937', cats: [] });
  });

  it('returns missing when SPARQL has no row', async () => {
    const { calls } = stubFetch(sparql());

    expect(await fetchCategories('Inconnu')).toEqual({ kind: 'missing' });
    expect(calls).toHaveLength(1);
  });

  it('falls back to the Action API on a 5xx', async () => {
    const { calls } = stubFetch(fallbackApi);

    expect(await fetchCategories('Albert Einstein')).toEqual({
      kind: 'found',
      qid: 'Q937',
      cats,
    });

    const api = calls.slice(1);
    expect(api).toHaveLength(4);
    for (const { url, init } of api) {
      expect(url.origin + url.pathname).toBe('https://www.wikidata.org/w/api.php');
      expect(url.searchParams.get('origin')).toBe('*');
      expect(init.credentials).toBe('omit');
      expect(init.referrerPolicy).toBe('no-referrer');
      expect(init.headers).toHaveProperty('Api-User-Agent');
    }
    expect(api[0]!.url.searchParams.get('titles')).toBe('Albert Einstein');
    expect(api[0]!.url.searchParams.get('sites')).toBe('frwiki');
  });

  it('falls back on a network error and on a 429', async () => {
    stubFetch((url) => (url.hostname === 'query.wikidata.org' ? status(429) : fallbackApi(url)));
    expect((await fetchCategories('A')).kind).toBe('found');

    stubFetch((url) =>
      url.hostname === 'query.wikidata.org' ? Promise.reject(new TypeError('x')) : fallbackApi(url),
    );
    expect((await fetchCategories('A')).kind).toBe('found');
  });

  it('skips deprecated claims and falls back to the id without a label', async () => {
    stubFetch((url) => {
      if (url.hostname === 'query.wikidata.org') return status(500);
      if (url.searchParams.get('action') === 'wbgetclaims') {
        return json({
          claims: {
            [url.searchParams.get('property')!]: [
              { mainsnak: { datavalue: { value: { id: 'Q1' } } }, rank: 'deprecated' },
              { mainsnak: { datavalue: { value: { id: 'Q2' } } }, rank: 'preferred' },
            ],
          },
        });
      }
      if (url.searchParams.get('props') === 'labels') return json({ entities: { Q2: {} } });
      return json({ entities: { Q9: { id: 'Q9' } } });
    });

    expect(await fetchCategories('A')).toEqual({
      kind: 'found',
      qid: 'Q9',
      cats: [
        { id: 'Q2', label: 'Q2', prop: 'P31' },
        { id: 'Q2', label: 'Q2', prop: 'P106' },
      ],
    });
  });

  it('returns missing when the fallback finds no page', async () => {
    const { calls } = stubFetch((url) =>
      url.hostname === 'query.wikidata.org'
        ? status(500)
        : json({ entities: { '-1': { site: 'frwiki', title: 'Zzz', missing: '' } } }),
    );

    expect(await fetchCategories('Zzz')).toEqual({ kind: 'missing' });
    expect(calls).toHaveLength(2);
  });

  it('reads Retry-After in seconds', async () => {
    stubFetch(status(429, { 'Retry-After': '30' }));

    expect(await fetchCategories('A')).toEqual({ kind: 'error', retryAfter: 30 });
  });

  it('defaults to 5 s on a 429 without a usable Retry-After', async () => {
    stubFetch(status(429));
    expect(await fetchCategories('A')).toEqual({ kind: 'error', retryAfter: 5 });

    stubFetch(status(429, { 'Retry-After': 'soon' }));
    expect(await fetchCategories('A')).toEqual({ kind: 'error', retryAfter: 5 });
  });

  it('reads Retry-After as an HTTP date', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-10-16T10:00:00Z'));
    stubFetch(status(429, { 'Retry-After': 'Fri, 16 Oct 2026 10:01:00 GMT' }));

    expect(await fetchCategories('A')).toEqual({ kind: 'error', retryAfter: 60 });
  });

  it('keeps the wait of the fallback when both fail', async () => {
    stubFetch((url) =>
      url.hostname === 'query.wikidata.org' ? status(503) : status(429, { 'Retry-After': '12' }),
    );

    expect(await fetchCategories('A')).toEqual({ kind: 'error', retryAfter: 12 });
  });

  it('reports maxlag from the Action API as an error with a wait', async () => {
    stubFetch((url) =>
      url.hostname === 'query.wikidata.org' ? status(503) : json({ error: { code: 'maxlag' } }),
    );

    expect(await fetchCategories('A')).toEqual({ kind: 'error', retryAfter: 5 });
  });

  it('returns an error when both endpoints fail on the network', async () => {
    const { calls } = stubFetch(new TypeError('offline'));

    expect(await fetchCategories('A')).toEqual({ kind: 'error' });
    expect(calls).toHaveLength(2);
  });

  it('returns an error on a malformed body without calling the fallback', async () => {
    const { calls } = stubFetch(json({ nope: 1 }));

    expect(await fetchCategories('A')).toEqual({ kind: 'error' });
    expect(calls).toHaveLength(1);
  });

  it('returns an error on a 4xx other than 429 without calling the fallback', async () => {
    const { calls } = stubFetch(status(400));

    expect(await fetchCategories('A')).toEqual({ kind: 'error' });
    expect(calls).toHaveLength(1);
  });

  it('rejects with the abort reason when the caller aborts', async () => {
    const controller = new AbortController();
    const { calls } = stubFetch(
      (_url, init) =>
        new Promise<Response>((_resolve, reject) => {
          init.signal!.addEventListener('abort', () => reject(init.signal!.reason as Error));
        }),
    );

    const pending = fetchCategories('A', controller.signal);
    await vi.waitFor(() => expect(calls).toHaveLength(1));
    controller.abort();

    await expect(pending).rejects.toMatchObject({ name: 'AbortError' });
    expect(calls).toHaveLength(1);
  });

  it('rejects at once when the signal is already aborted', async () => {
    stubFetch(einstein);

    await expect(fetchCategories('A', AbortSignal.abort())).rejects.toMatchObject({
      name: 'AbortError',
    });
  });

  it('turns its own timeout into an error', async () => {
    stubFetch(
      (_url, init) =>
        new Promise<Response>((_resolve, reject) => {
          init.signal!.addEventListener('abort', () => reject(init.signal!.reason as Error));
        }),
    );
    vi.spyOn(AbortSignal, 'timeout').mockImplementation(() =>
      AbortSignal.abort(new DOMException('t', 'TimeoutError')),
    );

    expect(await fetchCategories('A')).toEqual({ kind: 'error' });
  });
});
