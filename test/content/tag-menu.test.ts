import { fakeBrowser } from '@webext-core/fake-browser';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import modale from '../fixtures/modale.html?raw';
import ouvert from '../fixtures/modale-menu-ouvert.html?raw';
import masse from '../fixtures/modale-masse.html?raw';
import resultat from '../fixtures/modale-masse-resultat.html?raw';
import retirer from '../fixtures/modale-retirer.html?raw';
import selection from '../fixtures/selection.html?raw';
import { anchors } from '../../src/content/dom/anchors';
import { query, queryAll } from '../../src/content/dom/query';
import { starters } from '../../src/content/features';
import { startRunner } from '../../src/content/runner';
import { features } from '../../src/shared/features';
import { setFeature } from '../../src/shared/settings';

const frame = async (): Promise<void> => {
  await Promise.resolve();
  await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
};

const marked = (): Element[] => queryAll('[data-wmpal-tag-menu]', document.body);
const kinds = (): (string | null)[] => marked().map((el) => el.getAttribute('data-wmpal-tag-menu'));

let stop = (): void => undefined;
const start = (): void => {
  stop = startRunner(features, starters);
};

beforeEach(() => {
  fakeBrowser.reset();
});

afterEach(() => {
  stop();
  document.body.innerHTML = '';
});

describe('startTagMenu', () => {
  it.each([
    ['detail modal', modale, 'detail'],
    ['detail modal with the menu open', ouvert, 'detail'],
    ['bulk apply modal', masse, 'bulk'],
    ['bulk remove modal', retirer, 'bulk'],
  ])('marks the %s', async (_name, html, kind) => {
    document.body.innerHTML = html;
    start();
    await frame();
    expect(kinds()).toEqual([kind]);
    expect(marked()[0]!.classList.contains('card-frame')).toBe(true);
  });

  it('marks nothing on the selection bar and the result view', async () => {
    document.body.innerHTML = selection + resultat;
    start();
    await frame();
    expect(kinds()).toEqual([]);
  });

  it('never puts data-wmpal on a native node', async () => {
    document.body.innerHTML = masse + modale;
    start();
    await frame();
    expect(queryAll('[data-wmpal]', document.body)).toEqual([]);
  });

  it('removes the marker when the bulk modal turns into its result view', async () => {
    document.body.innerHTML = masse;
    start();
    await frame();
    expect(kinds()).toEqual(['bulk']);

    const modal = query(anchors.bulkTagModal)!;
    const next = new DOMParser().parseFromString(resultat, 'text/html').body;
    modal.innerHTML = query('div.card-frame', next)!.innerHTML;
    await frame();
    expect(queryAll(anchors.bulkTagModal)).toEqual([]);
    expect(kinds()).toEqual([]);
  });

  it('unmarks a bulk modal detached from the document', async () => {
    document.body.innerHTML = masse;
    start();
    await frame();
    const modal = query(anchors.bulkTagModal)!;
    expect(modal.getAttribute('data-wmpal-tag-menu')).toBe('bulk');
    // The parent leaves with it: the frame keeps its parent, so its anchors through closest
    modal.parentElement!.remove();
    await frame();
    expect(modal.hasAttribute('data-wmpal-tag-menu')).toBe(false);
  });

  it('marks a modal added after start', async () => {
    start();
    await frame();
    document.body.innerHTML = masse;
    await frame();
    expect(kinds()).toEqual(['bulk']);
  });

  it('removes every marker on stop', async () => {
    document.body.innerHTML = modale + masse;
    start();
    await frame();
    expect(kinds()).toHaveLength(2);
    stop();
    expect(kinds()).toEqual([]);
  });

  it('sets nothing with the feature off', async () => {
    await setFeature('tag-menu', false);
    document.body.innerHTML = modale + masse;
    start();
    await frame();
    expect(kinds()).toEqual([]);
  });

  describe('--wmpal-tag-rows', () => {
    const rows = (): string => document.documentElement.style.getPropertyValue('--wmpal-tag-rows');
    const resize = (height: number): void => {
      vi.stubGlobal('innerHeight', height);
      window.dispatchEvent(new Event('resize'));
    };

    beforeEach(() => {
      document.documentElement.style.fontSize = '16px';
      vi.stubGlobal('innerHeight', 900);
    });

    afterEach(() => {
      vi.unstubAllGlobals();
      document.documentElement.style.cssText = '';
    });

    it('is set at start from the viewport height', async () => {
      start();
      await frame();
      // floor((900 * 0.9 - 11 * 16) / 36)
      expect(rows()).toBe('17');
    });

    it('follows the viewport height on resize', async () => {
      start();
      await frame();
      resize(1200);
      expect(rows()).toBe('25');
    });

    it('keeps at least one row on a very low viewport', async () => {
      vi.stubGlobal('innerHeight', 100);
      start();
      await frame();
      expect(rows()).toBe('1');
    });

    it('scales with the root font size', async () => {
      document.documentElement.style.fontSize = '20px';
      start();
      await frame();
      // floor((810 - 220) / 45)
      expect(rows()).toBe('13');
    });

    it('is removed on stop and ignores later resizes', async () => {
      start();
      await frame();
      stop();
      expect(rows()).toBe('');
      resize(1200);
      expect(rows()).toBe('');
    });

    it('is not set with the feature off', async () => {
      await setFeature('tag-menu', false);
      start();
      await frame();
      resize(1200);
      expect(rows()).toBe('');
    });
  });
});
