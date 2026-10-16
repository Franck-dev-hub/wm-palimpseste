import { createStore, type Entries, type Entry } from '../shared/store';
import type { Category } from './wikidata';

export interface TagEntry extends Entry {
  cats: string[] | null;
  tags: string[];
}

const CAP = 5_000;

const store = createStore<TagEntry>('tagMemory', CAP);

const isStrings = (value: unknown): value is string[] =>
  Array.isArray(value) && value.every((item) => typeof item === 'string');

// Stored entries are cast, not checked: anything off-shape is dropped.
function isValid(value: unknown): value is TagEntry {
  if (typeof value !== 'object' || value === null) return false;
  const { cats, tags, at } = value as Record<string, unknown>;
  return (
    isStrings(tags) && (cats === null || isStrings(cats)) && typeof at === 'number' && isFinite(at)
  );
}

const validOnly = (entries: Entries<TagEntry>): Entries<TagEntry> =>
  Object.fromEntries(Object.entries(entries).filter(([, entry]) => isValid(entry)));

export async function readTagMemory(): Promise<Entries<TagEntry>> {
  return validOnly(await store.read());
}

export interface Snapshot {
  title: string;
  tags: string[];
  cats?: string[];
}

export function snapshotMany(cards: Snapshot[]): Promise<void> {
  return store.update((entries) => {
    const next = { ...entries };
    const at = Date.now();
    for (const { title, tags, cats } of cards) {
      const previous = next[title];
      if (tags.length === 0) {
        delete next[title];
        continue;
      }
      const known = isValid(previous) ? previous.cats : null;
      next[title] = { cats: cats ?? known, tags: [...tags], at };
    }
    return next;
  });
}

export function snapshot(title: string, tags: string[], cats?: string[]): Promise<void> {
  return snapshotMany([{ title, tags, cats }]);
}

export function completeCatsMany(all: Map<string, string[]>): Promise<void> {
  return store.update((entries) => {
    const next = { ...entries };
    const at = Date.now();
    for (const [title, cats] of all) {
      const previous = next[title];
      if (isValid(previous)) next[title] = { ...previous, cats: [...cats], at };
    }
    return next;
  });
}

export function completeCats(title: string, cats: string[]): Promise<void> {
  return completeCatsMany(new Map([[title, cats]]));
}

export type Proposal = { kind: 'tag'; name: string } | { kind: 'hint'; label: string };

export interface ProposeInput {
  title: string;
  cats: Category[];
  candidates: string[];
  posed: string[];
  memory: Entries<TagEntry>;
}

const MIN_SCORE = 2;
const MIN_SHARE = 2 / 3;

// Singular and plural must match, so a final s or x is dropped.
const normalise = (text: string): string =>
  text.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().trim().replace(/[sx]$/, '');

// Every person is P31 « être humain »: only the occupation tells two people apart.
const telling = (cats: Category[]): Category[] =>
  cats.some((cat) => cat.prop === 'P106') ? cats.filter((cat) => cat.prop === 'P106') : cats;

// French occupations read « acteur ou actrice de cinéma »: drop only the feminine word.
const shortLabel = ({ label, prop }: Category): string =>
  prop === 'P106' ? label.replace(/ ou \S+/, '') : label;

const HINT_LABELS = 3;

function bestScored({ title, cats, memory }: ProposeInput, candidates: string[]): string | null {
  const ids = new Set(telling(cats).map((cat) => cat.id));
  const similar = Object.entries(memory)
    // An untagged card is not tagged yet, not a vote against.
    .filter(
      ([other, entry]) =>
        other !== title && entry.tags.length > 0 && entry.cats?.some((id) => ids.has(id)),
    )
    .map(([, entry]) => entry);
  let best: { name: string; score: number; latest: number } | null = null;
  for (const name of candidates) {
    const tagged = similar.filter((entry) => entry.tags.includes(name));
    const score = tagged.length;
    // A shared generic class (« taxon ») splits cards between tags: only a clear majority counts.
    const majority = score >= MIN_SCORE && score >= similar.length * MIN_SHARE;
    const unanimous = score > 0 && score === similar.length;
    if (!majority && !unanimous) continue;
    const latest = Math.max(...tagged.map((entry) => entry.at));
    const wins =
      best === null ||
      score > best.score ||
      (score === best.score &&
        (latest > best.latest ||
          (latest === best.latest && name.localeCompare(best.name, 'fr') < 0)));
    if (wins) best = { name, score, latest };
  }
  return best?.name ?? null;
}

const words = (text: string): string[] =>
  text
    .split(/[^\p{L}\p{N}]+/u)
    .filter(Boolean)
    .map(normalise);

const sameName = (name: string, label: string): boolean => normalise(label) === normalise(name);

// « Drapeau » is in « drapeau national »; whole words only, so « Art » misses « artiste ».
const inLabel = (name: string, label: string): boolean => {
  const needle = words(name);
  const hay = words(label);
  if (needle.length === 0) return false;
  return hay.some((_, start) => needle.every((word, i) => hay[start + i] === word));
};

function namedIn(
  { cats }: ProposeInput,
  candidates: string[],
  match: (name: string, label: string) => boolean,
): string | null {
  const tierOf = (prop: Category['prop']) => (prop === 'P106' ? 0 : 1);
  let best: { name: string; tier: number } | null = null;
  for (const name of candidates) {
    const matching = cats.filter((cat) => match(name, shortLabel(cat)));
    if (matching.length === 0) continue;
    const tier = Math.min(...matching.map((cat) => tierOf(cat.prop)));
    if (best === null || tier < best.tier) best = { name, tier };
  }
  return best?.name ?? null;
}

export function propose(input: ProposeInput): Proposal | null {
  const posed = new Set(input.posed);
  const candidates = [...new Set(input.candidates)].filter((name) => !posed.has(name));
  const name =
    bestScored(input, candidates) ??
    namedIn(input, candidates, sameName) ??
    namedIn(input, candidates, inLabel);
  if (name !== null) return { kind: 'tag', name };
  const labels = [...new Set(telling(input.cats).map(shortLabel))].slice(0, HINT_LABELS);
  return labels.length > 0 ? { kind: 'hint', label: labels.join(', ') } : null;
}
