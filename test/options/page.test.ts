import { fakeBrowser } from '@webext-core/fake-browser';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ext } from '../../src/shared/ext';
import { features } from '../../src/shared/features';
import { setFeature } from '../../src/shared/settings';
import html from '../../src/options/options.html?raw';
import { renderOptions } from '../../src/options/page';

const registry = [
  { id: 'alpha', nameKey: 'alphaName', descriptionKey: 'alphaDesc', default: true },
  { id: 'beta', nameKey: 'betaName', descriptionKey: 'betaDesc', default: false },
];

const checkbox = (id: string) => document.getElementById(`feature-${id}`) as HTMLInputElement;
const stored = async () => (await ext.storage.local.get('settings')).settings;

describe('renderOptions', () => {
  beforeEach(() => {
    fakeBrowser.reset();
    vi.restoreAllMocks();
    vi.spyOn(ext.i18n, 'getMessage').mockImplementation((key) => `t:${key}`);
    vi.spyOn(ext.i18n, 'getUILanguage').mockReturnValue('en');
    document.documentElement.innerHTML = html;
  });

  it('translates the static texts and sets the page language', async () => {
    await renderOptions([]);
    expect(document.querySelector('h1')?.textContent).toBe('t:optionsTitle');
    expect(document.documentElement.lang).toBe('en');
  });

  it('shows the empty message and no row for an empty registry', async () => {
    await renderOptions([]);
    expect(document.getElementById('empty')?.hidden).toBe(false);
    expect(document.querySelectorAll('li')).toHaveLength(0);
  });

  it('hides the empty message and renders one row per feature', async () => {
    await renderOptions(registry);
    expect(document.getElementById('empty')?.hidden).toBe(true);
    const rows = document.querySelectorAll('li');
    expect(rows).toHaveLength(2);
    expect(rows[0]?.textContent).toContain('t:alphaName');
    expect(rows[0]?.textContent).toContain('t:alphaDesc');
    expect(rows[1]?.textContent).toContain('t:betaName');
  });

  it('checks the switches from the defaults', async () => {
    await renderOptions(registry);
    expect(checkbox('alpha').checked).toBe(true);
    expect(checkbox('beta').checked).toBe(false);
  });

  it('shows the Wikipedia feature enabled by default', async () => {
    await renderOptions(features);
    const row = checkbox('wikipedia').closest('li');
    expect(row?.textContent).toContain('t:wikipediaName');
    expect(checkbox('wikipedia').checked).toBe(true);
  });

  it('checks the switches from the stored settings', async () => {
    await setFeature('alpha', false);
    await setFeature('beta', true);
    await renderOptions(registry);
    expect(checkbox('alpha').checked).toBe(false);
    expect(checkbox('beta').checked).toBe(true);
  });

  it('writes nothing on load', async () => {
    await renderOptions(registry);
    expect(await stored()).toBeUndefined();
  });

  it('writes a click to the storage', async () => {
    await renderOptions(registry);
    checkbox('beta').click();
    await vi.waitFor(async () =>
      expect(await stored()).toEqual({ version: 1, features: { beta: true } }),
    );
  });

  it('saves two rapid clicks on two switches', async () => {
    await renderOptions(registry);
    checkbox('alpha').click();
    checkbox('beta').click();
    await vi.waitFor(async () =>
      expect(await stored()).toEqual({ version: 1, features: { alpha: false, beta: true } }),
    );
  });

  it('follows a change made elsewhere', async () => {
    await renderOptions(registry);
    await setFeature('beta', true);
    await vi.waitFor(() => expect(checkbox('beta').checked).toBe(true));
  });

  it('falls back to the defaults when the storage is cleared', async () => {
    await setFeature('alpha', false);
    await renderOptions(registry);
    await ext.storage.local.clear();
    await vi.waitFor(() => expect(checkbox('alpha').checked).toBe(true));
  });

  it('stops following changes once cleaned up', async () => {
    const cleanup = await renderOptions(registry);
    cleanup();
    await setFeature('beta', true);
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(checkbox('beta').checked).toBe(false);
  });

  describe('with a slow initial read', () => {
    const slowRead = () => {
      let resolve!: (value: Record<string, unknown>) => void;
      const pending = new Promise<Record<string, unknown>>((r) => (resolve = r));
      vi.spyOn(ext.storage.local, 'get').mockReturnValueOnce(pending as never);
      return resolve;
    };

    it('does not apply a read older than a change event', async () => {
      const resolve = slowRead();
      const rendered = renderOptions(registry);
      await ext.storage.local.set({ settings: { version: 1, features: { beta: true } } });
      await vi.waitFor(() => expect(checkbox('beta').checked).toBe(true));
      resolve({});
      await rendered;
      expect(checkbox('beta').checked).toBe(true);
    });

    it('does not revert a click made before the read resolves', async () => {
      const resolve = slowRead();
      const rendered = renderOptions(registry);
      checkbox('beta').click();
      await vi.waitFor(async () => expect(await stored()).toBeDefined());
      resolve({});
      await rendered;
      expect(checkbox('beta').checked).toBe(true);
    });
  });
});
