import { ext } from './ext';

export interface Entry {
  at: number;
}
export type Entries<T extends Entry> = Record<string, T>;

export interface Store<T extends Entry> {
  read: () => Promise<Entries<T>>;
  update: (change: (entries: Entries<T>) => Entries<T>) => Promise<void>;
}

const VERSION = 1;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

function newest<T extends Entry>(entries: Entries<T>, keep: number): Entries<T> {
  const sorted = Object.entries(entries).sort(([, a], [, b]) => b.at - a.at);
  return Object.fromEntries(sorted.slice(0, keep));
}

export function createStore<T extends Entry>(key: string, cap: number): Store<T> {
  async function load(): Promise<Entries<T>> {
    const stored = await ext.storage.local.get(key);
    const raw = stored[key];
    return isRecord(raw) && raw.version === VERSION && isRecord(raw.entries)
      ? (raw.entries as Entries<T>)
      : {};
  }

  const save = (entries: Entries<T>) =>
    ext.storage.local.set({ [key]: { version: VERSION, entries } });

  async function write(entries: Entries<T>): Promise<void> {
    const capped = newest(entries, cap);
    try {
      await save(capped);
    } catch {
      try {
        await save(newest(capped, Math.floor(Object.keys(capped).length / 2)));
      } catch (error) {
        console.error(`Palimpseste: cannot write "${key}"`, error);
      }
    }
  }

  // A read-modify-write race would drop one of two rapid updates.
  let queue: Promise<unknown> = Promise.resolve();
  const enqueue = <R>(task: () => Promise<R>): Promise<R> => {
    const run = queue.then(task);
    queue = run.catch(() => undefined);
    return run;
  };

  return {
    read: () => enqueue(load),
    update: (change) => enqueue(async () => write(change({ ...(await load()) }))),
  };
}
