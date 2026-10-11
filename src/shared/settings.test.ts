import { fakeBrowser } from '@webext-core/fake-browser';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ext } from './ext';
import { onSettingsChanged, parseSettings, readSettings, setFeature } from './settings';

const registry = [
  { id: 'alpha', default: true },
  { id: 'beta', default: false },
];
const defaults = { version: 1, features: { alpha: true, beta: false } };

const rawSettings = async () => (await ext.storage.local.get('settings')).settings;

beforeEach(() => {
  fakeBrowser.reset();
  vi.restoreAllMocks();
});

describe('parseSettings', () => {
  it.each([
    ['undefined', undefined],
    ['null', null],
    ['a string', 'nope'],
    ['an unknown version', { version: 2, features: { alpha: false } }],
    ['no version', { features: { alpha: false } }],
  ])('returns defaults for %s', (_label, raw) => {
    expect(parseSettings(raw, registry)).toEqual(defaults);
  });

  it('returns defaults when features is not an object', () => {
    expect(parseSettings({ version: 1, features: 'x' }, registry)).toEqual(defaults);
  });

  it('keeps stored booleans and defaults the rest', () => {
    expect(parseSettings({ version: 1, features: { alpha: false } }, registry)).toEqual({
      version: 1,
      features: { alpha: false, beta: false },
    });
  });

  it('defaults a non-boolean value', () => {
    const raw = { version: 1, features: { alpha: 'false', beta: 1 } };

    expect(parseSettings(raw, registry)).toEqual(defaults);
  });

  it('ignores unknown ids', () => {
    const raw = { version: 1, features: { alpha: false, gone: true } };

    expect(parseSettings(raw, registry).features).toEqual({ alpha: false, beta: false });
  });
});

describe('readSettings', () => {
  it('returns defaults without a settings key and writes nothing', async () => {
    expect(await readSettings(registry)).toEqual(defaults);
    expect(await ext.storage.local.get(null)).toEqual({});
  });

  it.each([
    ['a non-object', 'nope'],
    ['an unknown version', { version: 9, features: { alpha: false } }],
    ['a non-boolean value', { version: 1, features: { alpha: 'no' } }],
  ])('returns defaults for %s and leaves storage intact', async (_label, stored) => {
    await ext.storage.local.set({ settings: stored });

    expect(await readSettings(registry)).toEqual(defaults);
    expect(await rawSettings()).toEqual(stored);
  });

  it('ignores an unknown id', async () => {
    await ext.storage.local.set({
      settings: { version: 1, features: { alpha: false, gone: true } },
    });

    expect(await readSettings(registry)).toEqual({
      version: 1,
      features: { alpha: false, beta: false },
    });
  });
});

describe('setFeature', () => {
  it('starts from an empty record when nothing is stored', async () => {
    await setFeature('alpha', false);

    expect(await rawSettings()).toEqual({ version: 1, features: { alpha: false } });
  });

  it('keeps unknown ids already stored', async () => {
    await ext.storage.local.set({ settings: { version: 1, features: { gone: true } } });

    await setFeature('alpha', false);

    expect(await rawSettings()).toEqual({ version: 1, features: { gone: true, alpha: false } });
  });

  it('replaces an unknown version with a fresh record', async () => {
    await ext.storage.local.set({ settings: { version: 9, features: { gone: true } } });

    await setFeature('alpha', false);

    expect(await rawSettings()).toEqual({ version: 1, features: { alpha: false } });
  });

  it('saves two rapid calls that are not awaited between', async () => {
    const first = setFeature('alpha', false);
    const second = setFeature('beta', true);
    await Promise.all([first, second]);

    expect(await rawSettings()).toEqual({ version: 1, features: { alpha: false, beta: true } });
  });

  it('does not jam the queue after a failed write', async () => {
    vi.spyOn(ext.storage.local, 'set').mockRejectedValueOnce(new Error('quota'));

    await expect(setFeature('alpha', false)).rejects.toThrow('quota');
    await setFeature('beta', true);

    expect(await rawSettings()).toEqual({ version: 1, features: { beta: true } });
  });
});

describe('onSettingsChanged', () => {
  it('calls back with the parsed settings', async () => {
    const cb = vi.fn();
    onSettingsChanged(registry, cb);

    await setFeature('alpha', false);

    await vi.waitFor(() =>
      expect(cb).toHaveBeenCalledWith({ version: 1, features: { alpha: false, beta: false } }),
    );
  });

  it('calls back with defaults when storage is cleared', async () => {
    await setFeature('alpha', false);
    const cb = vi.fn();
    onSettingsChanged(registry, cb);

    await ext.storage.local.clear();

    await vi.waitFor(() => expect(cb).toHaveBeenCalledWith(defaults));
  });

  it('ignores other keys and other areas', async () => {
    const cb = vi.fn();
    onSettingsChanged(registry, cb);

    await ext.storage.local.set({ other: 1 });
    await ext.storage.sync.set({ settings: { version: 1, features: { alpha: false } } });
    await setFeature('beta', true);

    await vi.waitFor(() => expect(cb).toHaveBeenCalled());
    expect(cb).toHaveBeenCalledTimes(1);
  });

  it('stops calling back after unsubscribe', async () => {
    const cb = vi.fn();
    const unsubscribe = onSettingsChanged(registry, cb);
    unsubscribe();

    await setFeature('alpha', false);
    await new Promise((resolve) => setTimeout(resolve, 20));

    expect(cb).not.toHaveBeenCalled();
  });
});
