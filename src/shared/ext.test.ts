import { afterEach, describe, expect, it, vi } from 'vitest';

afterEach(() => {
  vi.unstubAllGlobals();
  vi.resetModules();
});

describe('ext', () => {
  it('is browser when it exists', async () => {
    const fakeBrowser = {};
    vi.stubGlobal('browser', fakeBrowser);
    vi.stubGlobal('chrome', {});
    vi.resetModules();

    const { ext } = await import('./ext');

    expect(ext).toBe(fakeBrowser);
  });

  it('falls back to chrome without browser', async () => {
    const fakeChrome = {};
    vi.stubGlobal('browser', undefined);
    vi.stubGlobal('chrome', fakeChrome);
    vi.resetModules();

    const { ext } = await import('./ext');

    expect(ext).toBe(fakeChrome);
  });

  it('runs on the fake browser from the test setup', async () => {
    const { ext } = await import('./ext');

    await ext.storage.local.set({ key: 'value' });

    expect(await ext.storage.local.get('key')).toEqual({ key: 'value' });
  });
});
