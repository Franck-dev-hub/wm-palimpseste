import { fakeBrowser } from '@webext-core/fake-browser';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ext } from '../../src/shared/ext';
import {
  completeCats,
  completeCatsMany,
  readTagMemory,
  snapshot,
  snapshotMany,
} from '../../src/content/tag-memory';

const seed = (entries: Record<string, unknown>) =>
  ext.storage.local.set({ tagMemory: { version: 1, entries } });

beforeEach(() => {
  fakeBrowser.reset();
  vi.restoreAllMocks();
});

describe('snapshot', () => {
  it('keeps one entry per card, the last snapshot wins', async () => {
    await snapshot('Alien', ['SF'], ['Q1']);
    await snapshot('Alien', ['SF', 'Horreur'], ['Q1']);
    const all = await readTagMemory();
    expect(Object.keys(all)).toEqual(['Alien']);
    expect(all.Alien).toMatchObject({ cats: ['Q1'], tags: ['SF', 'Horreur'] });
  });

  it('forgets a removed tag', async () => {
    await snapshot('Alien', ['SF', 'Horreur']);
    await snapshot('Alien', ['SF']);
    expect((await readTagMemory()).Alien?.tags).toEqual(['SF']);
  });

  it('deletes the entry when no tag is left', async () => {
    await snapshot('Alien', ['SF']);
    await snapshot('Alien', []);
    expect(await readTagMemory()).toEqual({});
  });

  it('never stores a card without tag', async () => {
    await snapshot('Alien', []);
    expect(await readTagMemory()).toEqual({});
  });

  it('keeps the known cats when none are given', async () => {
    await snapshot('Alien', ['SF'], ['Q1']);
    await snapshot('Alien', ['SF', 'Horreur']);
    expect((await readTagMemory()).Alien?.cats).toEqual(['Q1']);
  });

  it('starts a new card with unknown cats', async () => {
    await snapshot('Alien', ['SF']);
    expect((await readTagMemory()).Alien?.cats).toBeNull();
  });

  it('replaces the cats when new ones are given', async () => {
    await snapshot('Alien', ['SF'], ['Q1']);
    await snapshot('Alien', ['SF'], ['Q2']);
    expect((await readTagMemory()).Alien?.cats).toEqual(['Q2']);
  });

  it('updates the timestamp', async () => {
    await seed({ Alien: { cats: null, tags: ['SF'], at: 1 } });
    await snapshot('Alien', ['SF']);
    expect((await readTagMemory()).Alien?.at).toBeGreaterThan(1);
  });
});

describe('completeCats', () => {
  it('fills the cats and keeps the tags', async () => {
    await snapshot('Alien', ['SF', 'Horreur']);
    await completeCats('Alien', ['Q1', 'Q2']);
    expect((await readTagMemory()).Alien).toMatchObject({
      cats: ['Q1', 'Q2'],
      tags: ['SF', 'Horreur'],
    });
  });

  it('does nothing for an unknown title', async () => {
    await completeCats('Alien', ['Q1']);
    expect(await readTagMemory()).toEqual({});
  });
});

describe('cap', () => {
  it('purges the oldest entries and keeps the newest', async () => {
    const entries: Record<string, unknown> = {};
    for (let i = 1; i <= 5_000; i++) entries[`card${i}`] = { cats: null, tags: ['t'], at: i };
    await seed(entries);
    await snapshot('fresh', ['t']);
    const all = await readTagMemory();
    expect(Object.keys(all)).toHaveLength(5_000);
    expect(all.fresh).toBeDefined();
    expect(all.card1).toBeUndefined();
    expect(all.card2).toBeDefined();
  });
});

describe('malformed entries', () => {
  it('are ignored on read', async () => {
    await seed({
      ok: { cats: ['Q1'], tags: ['a'], at: 1 },
      noTags: { cats: null, at: 1 },
      badTags: { cats: null, tags: [1], at: 1 },
      badCats: { cats: 'Q1', tags: ['a'], at: 1 },
      noAt: { cats: null, tags: ['a'] },
      nan: { cats: null, tags: ['a'], at: null },
      str: 'nope',
      nul: null,
    });
    expect(Object.keys(await readTagMemory())).toEqual(['ok']);
  });

  it('are replaced by the next snapshot, without borrowing their cats', async () => {
    await seed({ Alien: { cats: 'bad', tags: 'bad', at: 1 } });
    await snapshot('Alien', ['SF']);
    expect((await readTagMemory()).Alien).toMatchObject({ cats: null, tags: ['SF'] });
  });

  it('are left alone by a completion', async () => {
    await seed({ Alien: { tags: 'bad', at: 1 } });
    await completeCats('Alien', ['Q1']);
    expect(await readTagMemory()).toEqual({});
  });
});

describe('snapshotMany', () => {
  it('applies the snapshot rules to every card in one write', async () => {
    await snapshot('Alien', ['SF'], ['Q1']);
    await snapshot('Gone', ['x']);
    const set = vi.spyOn(ext.storage.local, 'set');
    await snapshotMany([
      { title: 'Alien', tags: ['SF', 'Horreur'] },
      { title: 'Brazil', tags: ['SF'], cats: ['Q2'] },
      { title: 'Gone', tags: [] },
    ]);
    const all = await readTagMemory();
    expect(set).toHaveBeenCalledTimes(1);
    expect(all.Alien).toMatchObject({ cats: ['Q1'], tags: ['SF', 'Horreur'] });
    expect(all.Brazil).toMatchObject({ cats: ['Q2'], tags: ['SF'] });
    expect(all.Gone).toBeUndefined();
  });

  it('updates the timestamp and lets the last duplicate win', async () => {
    await seed({ Alien: { cats: null, tags: ['SF'], at: 1 } });
    await snapshotMany([
      { title: 'Alien', tags: ['a'] },
      { title: 'Alien', tags: ['b'] },
    ]);
    const { Alien } = await readTagMemory();
    expect(Alien?.tags).toEqual(['b']);
    expect(Alien?.at).toBeGreaterThan(1);
  });

  it('still applies the cap', async () => {
    const entries: Record<string, unknown> = {};
    for (let i = 1; i <= 5_000; i++) entries[`card${i}`] = { cats: null, tags: ['t'], at: i };
    await seed(entries);
    await snapshotMany([
      { title: 'fresh1', tags: ['t'] },
      { title: 'fresh2', tags: ['t'] },
    ]);
    const all = await readTagMemory();
    expect(Object.keys(all)).toHaveLength(5_000);
    expect(all.fresh2).toBeDefined();
    expect(all.card1).toBeUndefined();
    expect(all.card3).toBeDefined();
  });
});

describe('completeCatsMany', () => {
  it('completes known cards in one write and ignores unknown ones', async () => {
    await snapshot('Alien', ['SF']);
    await snapshot('Brazil', ['SF']);
    const set = vi.spyOn(ext.storage.local, 'set');
    await completeCatsMany(
      new Map([
        ['Alien', ['Q1']],
        ['Brazil', ['Q2']],
        ['Ghost', ['Q3']],
      ]),
    );
    const all = await readTagMemory();
    expect(set).toHaveBeenCalledTimes(1);
    expect(all.Alien).toMatchObject({ cats: ['Q1'], tags: ['SF'] });
    expect(all.Brazil?.cats).toEqual(['Q2']);
    expect(all.Ghost).toBeUndefined();
  });
});
