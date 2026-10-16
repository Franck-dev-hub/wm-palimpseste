import { ext } from '../shared/ext';
import { createStore, type Entry } from '../shared/store';

export type Prop = 'P31' | 'P106';
export interface Category {
  id: string;
  label: string;
  prop: Prop;
}
export type CategoriesResult =
  | { kind: 'found'; qid: string; cats: Category[] }
  | { kind: 'missing' }
  | { kind: 'error'; retryAfter?: number };

const SPARQL_URL = 'https://query.wikidata.org/sparql';
const API_URL = 'https://www.wikidata.org/w/api.php';
const WIKI = 'https://fr.wikipedia.org/';
const PROPS: readonly Prop[] = ['P31', 'P106'];
const TIMEOUT_MS = 10_000;
const DEFAULT_WAIT_S = 5;
// wbgetentities takes 50 ids at most
const MAX_CATS = 50;

// Retriable failure; `fallback` says whether the Action API may still answer.
class Failure extends Error {
  constructor(
    readonly fallback: boolean,
    readonly retryAfter?: number,
  ) {
    super('wikidata request failed');
  }
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const isQid = (value: unknown): value is string =>
  typeof value === 'string' && /^Q\d+$/.test(value);

function parseRetryAfter(header: string | null): number | undefined {
  if (header === null) return undefined;
  const value = header.trim();
  if (/^\d+$/.test(value)) return Number(value);
  const date = Date.parse(value);
  return Number.isNaN(date) ? undefined : Math.max(0, Math.ceil((date - Date.now()) / 1000));
}

export const sparqlLiteral = (text: string): string =>
  text
    .replaceAll('\\', '\\\\')
    .replaceAll('"', '\\"')
    .replaceAll('\n', '\\n')
    .replaceAll('\r', '\\r')
    .replaceAll('\t', '\\t');

function sparqlQuery(title: string): string {
  return `SELECT ?item ?cat ?catLabel ?prop WHERE {
  ?page schema:about ?item ;
        schema:isPartOf <${WIKI}> ;
        schema:name "${sparqlLiteral(title)}"@fr .
  OPTIONAL {
    { ?item wdt:P31 ?cat . BIND("P31" AS ?prop) }
    UNION
    { ?item wdt:P106 ?cat . BIND("P106" AS ?prop) }
  }
  SERVICE wikibase:label { bd:serviceParam wikibase:language "fr,en" . }
}`;
}

// A caller abort is rethrown as is, so it is never taken for a failure to cache.
async function get(url: URL, signal: AbortSignal | undefined): Promise<unknown> {
  const timeout = AbortSignal.timeout(TIMEOUT_MS);
  let response: Response;
  try {
    response = await fetch(url, {
      credentials: 'omit',
      referrerPolicy: 'no-referrer',
      headers: {
        'Api-User-Agent': `Palimpseste/${ext.runtime.getManifest().version} (+https://github.com/Franck-dev-hub/wm-palimpseste)`,
      },
      signal: signal ? AbortSignal.any([timeout, signal]) : timeout,
    });
  } catch (error) {
    if (signal?.aborted) throw error;
    throw new Failure(true);
  }

  if (!response.ok) {
    const retriable = response.status === 429 || response.status >= 500;
    const wait = parseRetryAfter(response.headers.get('Retry-After'));
    // a 429 without a usable Retry-After still pauses
    throw new Failure(retriable, response.status === 429 ? (wait ?? DEFAULT_WAIT_S) : wait);
  }
  try {
    return await response.json();
  } catch (error) {
    if (signal?.aborted) throw error;
    throw new Failure(false);
  }
}

const bad = (): never => {
  throw new Failure(false);
};

function entityId(uri: unknown): string {
  const id = typeof uri === 'string' ? uri.slice(uri.lastIndexOf('/') + 1) : '';
  return isQid(id) ? id : bad();
}

function bindings(body: unknown): unknown[] {
  if (!isRecord(body) || !isRecord(body.results) || !Array.isArray(body.results.bindings)) {
    return bad();
  }
  return body.results.bindings as unknown[];
}

function parseRows(rows: unknown[]): CategoriesResult {
  let qid: string | null = null;
  const cats = new Map<string, Category>();
  for (const row of rows) {
    if (!isRecord(row) || !isRecord(row.item)) return bad();
    qid ??= entityId(row.item.value);
    if (!isRecord(row.cat)) continue;
    const prop = isRecord(row.prop) ? row.prop.value : undefined;
    if (prop !== 'P31' && prop !== 'P106') return bad();
    const id = entityId(row.cat.value);
    const label = isRecord(row.catLabel) ? row.catLabel.value : undefined;
    cats.set(prop + id, { id, label: typeof label === 'string' ? label : id, prop });
  }
  return qid === null ? { kind: 'missing' } : { kind: 'found', qid, cats: [...cats.values()] };
}

const parseSparql = (body: unknown): CategoriesResult => parseRows(bindings(body));

async function viaSparql(title: string, signal?: AbortSignal): Promise<CategoriesResult> {
  const url = new URL(SPARQL_URL);
  url.searchParams.set('format', 'json');
  url.searchParams.set('query', sparqlQuery(title));
  return parseSparql(await get(url, signal));
}

async function api(params: Record<string, string>, signal?: AbortSignal): Promise<unknown> {
  const url = new URL(API_URL);
  for (const [name, value] of Object.entries({
    ...params,
    format: 'json',
    origin: '*',
  })) {
    url.searchParams.set(name, value);
  }
  const body = await get(url, signal);
  if (!isRecord(body)) return bad();
  if (isRecord(body.error)) {
    // maxlag is a 200 with an error body; its Retry-After is not readable here
    throw new Failure(false, body.error.code === 'maxlag' ? DEFAULT_WAIT_S : undefined);
  }
  return body;
}

async function claimTargets(qid: string, prop: Prop, signal?: AbortSignal): Promise<string[]> {
  const body = await api({ action: 'wbgetclaims', entity: qid, property: prop }, signal);
  if (!isRecord(body) || !isRecord(body.claims)) return bad();
  const claims = body.claims[prop] ?? [];
  if (!Array.isArray(claims)) return bad();
  const ids: string[] = [];
  for (const claim of claims as unknown[]) {
    if (!isRecord(claim) || claim.rank === 'deprecated') continue;
    const snak = claim.mainsnak;
    const value = isRecord(snak) && isRecord(snak.datavalue) ? snak.datavalue.value : undefined;
    if (isRecord(value) && isQid(value.id)) ids.push(value.id);
  }
  return ids;
}

async function labels(ids: string[], signal?: AbortSignal): Promise<Map<string, string>> {
  const body = await api(
    { action: 'wbgetentities', ids: ids.join('|'), props: 'labels', languages: 'fr|en' },
    signal,
  );
  if (!isRecord(body) || !isRecord(body.entities)) return bad();
  const result = new Map<string, string>();
  for (const [id, entity] of Object.entries(body.entities)) {
    const all = isRecord(entity) && isRecord(entity.labels) ? entity.labels : {};
    for (const language of ['fr', 'en']) {
      const label = isRecord(all[language]) ? all[language].value : undefined;
      if (typeof label === 'string') {
        result.set(id, label);
        break;
      }
    }
  }
  return result;
}

// 4 light requests (qid, P31, P106, labels) instead of one 455 KB props=claims
async function viaApi(title: string, signal?: AbortSignal): Promise<CategoriesResult> {
  const body = await api(
    { action: 'wbgetentities', sites: 'frwiki', titles: title, props: 'info' },
    signal,
  );
  if (!isRecord(body) || !isRecord(body.entities)) return bad();
  const entity = Object.values(body.entities)[0];
  if (!isRecord(entity)) return bad();
  if ('missing' in entity) return { kind: 'missing' };
  const qid = entity.id;
  if (!isQid(qid)) return bad();

  const targets = await Promise.all(PROPS.map((prop) => claimTargets(qid, prop, signal)));
  const found = new Map<string, { id: string; prop: Prop }>();
  PROPS.forEach((prop, index) => {
    for (const id of targets[index] ?? []) found.set(prop + id, { id, prop });
  });
  const kept = [...found.values()].slice(0, MAX_CATS);
  if (kept.length === 0) return { kind: 'found', qid, cats: [] };

  const names = await labels([...new Set(kept.map((cat) => cat.id))], signal);
  return {
    kind: 'found',
    qid,
    cats: kept.map(({ id, prop }) => ({ id, prop, label: names.get(id) ?? id })),
  };
}

// Rejects with the caller's abort reason when `signal` fires; every other failure is a result.
export async function fetchCategories(
  title: string,
  signal?: AbortSignal,
): Promise<CategoriesResult> {
  let first: Failure;
  try {
    return await viaSparql(title, signal);
  } catch (error) {
    if (!(error instanceof Failure)) throw error;
    first = error;
  }
  if (!first.fallback) return failed(first);

  try {
    return await viaApi(title, signal);
  } catch (error) {
    if (!(error instanceof Failure)) throw error;
    const waits = [first.retryAfter, error.retryAfter].filter((wait) => wait !== undefined);
    return { kind: 'error', ...(waits.length > 0 && { retryAfter: Math.max(...waits) }) };
  }
}

function failed({ retryAfter }: Failure): CategoriesResult {
  return retryAfter === undefined ? { kind: 'error' } : { kind: 'error', retryAfter };
}

const BATCH_SIZE = 50;
// Longer GET URLs risk a 414 from the endpoint.
const MAX_URL_LENGTH = 7_000;

function batchQuery(titles: string[]): string {
  const values = titles.map((title) => `"${sparqlLiteral(title)}"@fr`).join(' ');
  return `SELECT ?title ?item ?cat ?catLabel ?prop WHERE {
  VALUES ?title { ${values} }
  ?page schema:about ?item ;
        schema:isPartOf <${WIKI}> ;
        schema:name ?title .
  OPTIONAL {
    { ?item wdt:P31 ?cat . BIND("P31" AS ?prop) }
    UNION
    { ?item wdt:P106 ?cat . BIND("P106" AS ?prop) }
  }
  SERVICE wikibase:label { bd:serviceParam wikibase:language "fr,en" . }
}`;
}

function batchUrl(titles: string[]): URL {
  const url = new URL(SPARQL_URL);
  url.searchParams.set('format', 'json');
  url.searchParams.set('query', batchQuery(titles));
  return url;
}

// Halves a batch until its URL fits; a single title is always sent.
function fitUrl(titles: string[]): string[][] {
  if (titles.length <= 1 || batchUrl(titles).href.length <= MAX_URL_LENGTH) return [titles];
  const half = Math.ceil(titles.length / 2);
  return [...fitUrl(titles.slice(0, half)), ...fitUrl(titles.slice(half))];
}

function splitBatches(titles: string[]): string[][] {
  const batches: string[][] = [];
  for (let i = 0; i < titles.length; i += BATCH_SIZE) {
    batches.push(...fitUrl(titles.slice(i, i + BATCH_SIZE)));
  }
  return batches;
}

type BatchOutcome =
  { kind: 'ok'; byTitle: Map<string, CategoriesResult> } | { kind: 'error'; retryAfter?: number };

// No Action API fallback: it costs 4 requests per title.
async function fetchBatch(titles: string[]): Promise<BatchOutcome> {
  try {
    const grouped = new Map<string, unknown[]>();
    const asked = new Set(titles);
    for (const row of bindings(await get(batchUrl(titles), undefined))) {
      const title = isRecord(row) && isRecord(row.title) ? row.title.value : undefined;
      if (typeof title !== 'string') return bad();
      if (!asked.has(title)) continue;
      grouped.set(title, [...(grouped.get(title) ?? []), row]);
    }
    const byTitle = new Map<string, CategoriesResult>();
    for (const title of titles) {
      const rows = grouped.get(title);
      byTitle.set(title, rows === undefined ? { kind: 'missing' } : parseRows(rows));
    }
    return { kind: 'ok', byTitle };
  } catch (error) {
    if (!(error instanceof Failure)) throw error;
    return error.retryAfter === undefined
      ? { kind: 'error' }
      : { kind: 'error', retryAfter: error.retryAfter };
  }
}

export interface Categories {
  qid: string | null;
  cats: Category[];
}
interface CacheEntry extends Entry, Categories {}

const CACHE_CAP = 2000;
const MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;
const DISAMBIGUATION = 'Q4167410';

const cache = createStore<CacheEntry>('wikidataCache', CACHE_CAP);
const inflight = new Map<string, Promise<Categories | null>>();
let queue: Promise<unknown> = Promise.resolve();
let pausedUntil = 0;

const isCategory = (value: unknown): value is Category =>
  isRecord(value) &&
  typeof value.id === 'string' &&
  typeof value.label === 'string' &&
  (value.prop === 'P31' || value.prop === 'P106');

function fresh(entry: unknown): entry is CacheEntry {
  return (
    isRecord(entry) &&
    typeof entry.at === 'number' &&
    Date.now() - entry.at < MAX_AGE_MS &&
    (entry.qid === null || isQid(entry.qid)) &&
    Array.isArray(entry.cats) &&
    entry.cats.every(isCategory)
  );
}

const none = (): Categories => ({ qid: null, cats: [] });

// One request at a time, and none during a Retry-After pause.
function enqueue<R extends { kind: string; retryAfter?: number }>(
  request: () => Promise<R>,
): Promise<R | null> {
  const run = queue.then(async () => {
    if (Date.now() < pausedUntil) return null;
    const result = await request();
    if (result.kind === 'error' && result.retryAfter !== undefined) {
      pausedUntil = Date.now() + result.retryAfter * 1000;
    }
    return result;
  });
  queue = run.catch(() => undefined);
  return run;
}

// No caller signal: the request is shared, each caller races its own.
const fetchQueued = (title: string) => enqueue(() => fetchCategories(title));

type Resolved = Exclude<CategoriesResult, { kind: 'error' }>;

function toCategories(result: Resolved): Categories {
  return result.kind === 'found' &&
    !result.cats.some((cat) => cat.id === DISAMBIGUATION && cat.prop === 'P31')
    ? { qid: result.cats.length > 0 ? result.qid : null, cats: result.cats }
    : none();
}

async function load(title: string): Promise<Categories | null> {
  const cached = await cache.read().then(
    (entries) => entries[title],
    () => undefined,
  );
  if (fresh(cached)) return { qid: cached.qid, cats: cached.cats };
  if (Date.now() < pausedUntil) return null;

  const result = await fetchQueued(title);
  if (result === null || result.kind === 'error') return null;
  const value = toCategories(result);
  await cache.update((entries) => ({ ...entries, [title]: { ...value, at: Date.now() } }));
  return value;
}

function raceAbort<T>(promise: Promise<T>, signal: AbortSignal): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const onAbort = () => reject(signal.reason as Error);
    signal.addEventListener('abort', onAbort, { once: true });
    promise.then(resolve, reject).finally(() => signal.removeEventListener('abort', onAbort));
  });
}

// null: unknown for now, never cached. Rejects with the abort reason of this caller only.
export function categoriesOf(title: string, signal?: AbortSignal): Promise<Categories | null> {
  if (signal?.aborted) return Promise.reject(signal.reason as Error);
  let shared = inflight.get(title);
  if (shared === undefined) {
    shared = load(title).finally(() => inflight.delete(title));
    inflight.set(title, shared);
  }
  return signal ? raceAbort(shared, signal) : shared;
}

// Runs to the end even if the caller gave up, so the cache gets filled.
async function loadBatch(titles: string[]): Promise<Map<string, Categories>> {
  const outcome = await enqueue(() => fetchBatch(titles));
  const values = new Map<string, Categories>();
  if (outcome === null || outcome.kind === 'error') return values;
  for (const [title, result] of outcome.byTitle) {
    if (result.kind !== 'error') values.set(title, toCategories(result));
  }
  const at = Date.now();
  await cache.update((entries) => ({
    ...entries,
    ...Object.fromEntries([...values].map(([title, value]) => [title, { ...value, at }])),
  }));
  return values;
}

// Unresolved titles are absent; a caller abort rejects. Batches queue one after another.
export async function categoriesOfMany(
  titles: string[],
  signal?: AbortSignal,
): Promise<Map<string, Categories>> {
  if (signal?.aborted) throw signal.reason;
  const cached = await cache.read().catch((): Record<string, unknown> => ({}));
  const result = new Map<string, Categories>();
  const missing: string[] = [];
  for (const title of new Set(titles)) {
    const entry = cached[title];
    if (fresh(entry)) result.set(title, { qid: entry.qid, cats: entry.cats });
    else missing.push(title);
  }

  for (const batch of splitBatches(missing)) {
    if (signal?.aborted) throw signal.reason;
    if (Date.now() < pausedUntil) break;
    const loading = loadBatch(batch);
    const values = await (signal ? raceAbort(loading, signal) : loading);
    for (const [title, value] of values) result.set(title, value);
  }
  return result;
}
