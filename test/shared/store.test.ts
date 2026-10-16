import { fakeBrowser } from '@webext-core/fake-browser';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ext } from '../../src/shared/ext';
import { createStore, type Entry } from '../../src/shared/store';

interface Item extends Entry {
  n: number;
}

const KEY = 'testStore';
const item = (n: number, at = n): Item => ({ n, at });
const raw = async () => (await ext.storage.local.get(KEY))[KEY];

beforeEach(() => {
  fakeBrowser.reset();
  vi.restoreAllMocks();
});

describe('read', () => {
  it('returns an empty record when nothing is stored', async () => {
    expect(await createStore<Item>(KEY, 10).read()).toEqual({});
  });

  it.each([
    ['an unknown version', { version: 2, entries: { a: item(1) } }],
    ['no version', { entries: { a: item(1) } }],
    ['a string', 'nope'],
    ['entries not an object', { version: 1, entries: [] }],
  ])('ignores %s and leaves it stored', async (_label, value) => {
    await ext.storage.local.set({ [KEY]: value });
    expect(await createStore<Item>(KEY, 10).read()).toEqual({});
    expect(await raw()).toEqual(value);
  });

  it('returns stored entries', async () => {
    await ext.storage.local.set({ [KEY]: { version: 1, entries: { a: item(1) } } });
    expect(await createStore<Item>(KEY, 10).read()).toEqual({ a: item(1) });
  });
});

describe('update', () => {
  it('writes a versioned record', async () => {
    const store = createStore<Item>(KEY, 10);
    await store.update((entries) => ({ ...entries, a: item(1) }));
    expect(await raw()).toEqual({ version: 1, entries: { a: item(1) } });
  });

  it('replaces an unknown version on write', async () => {
    await ext.storage.local.set({ [KEY]: { version: 2, entries: { old: item(9) } } });
    await createStore<Item>(KEY, 10).update((entries) => ({ ...entries, a: item(1) }));
    expect(await raw()).toEqual({ version: 1, entries: { a: item(1) } });
  });

  it('purges the oldest entries past the cap', async () => {
    const store = createStore<Item>(KEY, 2);
    await store.update(() => ({ b: item(2, 20), a: item(1, 10), c: item(3, 30) }));
    expect(Object.keys(await store.read()).sort()).toEqual(['b', 'c']);
  });

  it('keeps both of two concurrent updates', async () => {
    const store = createStore<Item>(KEY, 10);
    await Promise.all([
      store.update((entries) => ({ ...entries, a: item(1) })),
      store.update((entries) => ({ ...entries, b: item(2) })),
    ]);
    expect(Object.keys(await store.read()).sort()).toEqual(['a', 'b']);
  });

  it('keeps running after a failing update', async () => {
    const store = createStore<Item>(KEY, 10);
    await expect(
      store.update(() => {
        throw new Error('boom');
      }),
    ).rejects.toThrow('boom');
    await store.update((entries) => ({ ...entries, a: item(1) }));
    expect(await store.read()).toEqual({ a: item(1) });
  });
});

describe('quota exceeded', () => {
  const four = () => ({ a: item(1), b: item(2), c: item(3), d: item(4) });

  it('purges the oldest half and retries once', async () => {
    const set = vi.spyOn(ext.storage.local, 'set').mockRejectedValueOnce(new Error('QUOTA'));
    const store = createStore<Item>(KEY, 10);
    await store.update(four);
    expect(set).toHaveBeenCalledTimes(2);
    expect(Object.keys(await store.read()).sort()).toEqual(['c', 'd']);
  });

  it('logs and resolves when the retry fails, settings intact', async () => {
    const settings = { version: 1, features: { alpha: true } };
    await ext.storage.local.set({ settings });
    const set = vi.spyOn(ext.storage.local, 'set').mockRejectedValue(new Error('QUOTA'));
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    await expect(createStore<Item>(KEY, 10).update(four)).resolves.toBeUndefined();
    expect(set).toHaveBeenCalledTimes(2);
    expect(error).toHaveBeenCalledOnce();
    set.mockRestore();
    expect((await ext.storage.local.get('settings')).settings).toEqual(settings);
  });
});
