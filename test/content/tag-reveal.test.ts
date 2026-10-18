import { fakeBrowser } from '@webext-core/fake-browser';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import ouvert from '../fixtures/modale-menu-ouvert.html?raw';
import revele from '../fixtures/revele.html?raw';
import { starters } from '../../src/content/features';
import { startRunner } from '../../src/content/runner';
import { features } from '../../src/shared/features';
import { setFeature } from '../../src/shared/settings';

const MARKER = 'data-wmpal-tag-reveal';
const VARS = ['top', 'right', 'rows'].map((name) => `--wmpal-reveal-${name}`);

const frame = async (): Promise<void> => {
  await Promise.resolve();
  await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
};

const settle = async (): Promise<void> => {
  await frame();
  await frame();
};

const flip = (): HTMLElement =>
  document.querySelector<HTMLElement>('[class*="animate-card-flip"]')!;
const card = (): HTMLElement => flip().firstElementChild as HTMLElement;
const windows = (): HTMLElement[] => [
  ...document.querySelectorAll<HTMLElement>('body > div.fixed'),
];
const frames = (): Element[] => windows().map((overlay) => overlay.firstElementChild!);
const marked = (): Element[] => [...document.querySelectorAll(`[${MARKER}]`)];
const next = (): HTMLElement => document.querySelectorAll<HTMLElement>('main button.w-12')[1]!;

const openWindow = (): HTMLElement => {
  const overlay = document.createElement('div');
  overlay.innerHTML = ouvert.replace(/^<!--.*?-->/s, '');
  const win = overlay.firstElementChild as HTMLElement;
  win.querySelector('button[aria-label="Fermer"]')!.addEventListener('click', () => win.remove());
  document.body.append(win);
  return win;
};

// Site stand-in: a click on the card opens its window, an arrow moves to the next card
let advance = (): void => undefined;
const fakeSite = (): void => {
  let index = 1;
  const show = (): void => {
    document.querySelector('main h3')!.textContent = `Card ${index}`;
    document.querySelector('main span.font-bold')!.textContent = String(index);
  };
  show();
  card().addEventListener('click', () => {
    if (windows().length === 0) openWindow();
  });
  advance = () => {
    index += 1;
    show();
  };
  next().addEventListener('click', advance);
};

const setFlipping = (running: boolean): void => {
  flip().getAnimations = (() =>
    running ? [{ animationName: 'card-flip', playState: 'running' }] : []) as never;
};

const endFlip = async (): Promise<void> => {
  setFlipping(false);
  flip().dispatchEvent(new Event('animationend', { bubbles: true }));
  await settle();
};

let stop = (): void => undefined;
const start = (): void => {
  stop = startRunner(features, starters);
};

const mount = (): void => {
  document.body.innerHTML = revele;
  fakeSite();
};

beforeEach(() => {
  fakeBrowser.reset();
});

afterEach(() => {
  stop();
  document.body.innerHTML = '';
  document.documentElement.removeAttribute('style');
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('startTagReveal', () => {
  it('opens the card window on a displayed card and marks it as ours', async () => {
    mount();
    start();
    await settle();
    expect(windows()).toHaveLength(1);
    expect(marked()).toEqual(frames());
    expect(frames()[0]!.classList.contains('card-frame')).toBe(true);
  });

  it('never puts data-wmpal on a native node', async () => {
    mount();
    start();
    await settle();
    expect(document.querySelectorAll('[data-wmpal]')).toHaveLength(0);
  });

  it('does nothing while the card is still flipping, then opens once it ends', async () => {
    mount();
    setFlipping(true);
    start();
    await settle();
    expect(windows()).toHaveLength(0);
    await endFlip();
    expect(windows()).toHaveLength(1);
  });

  it('does not open when the player already has a window open', async () => {
    mount();
    const own = openWindow();
    start();
    await settle();
    expect(windows()).toEqual([own]);
    expect(marked()).toHaveLength(0);
  });

  it('does not open after the player closed the window of the same card', async () => {
    mount();
    start();
    await settle();
    windows()[0]!.querySelector<HTMLElement>('button[aria-label="Fermer"]')!.click();
    await settle();
    expect(windows()).toHaveLength(0);
  });

  it('does not open for a card seen under a window of the player, once he closes it', async () => {
    mount();
    const own = openWindow();
    start();
    await settle();
    own.remove();
    await settle();
    expect(windows()).toHaveLength(0);
  });

  it('closes our window then opens the next card on a card change', async () => {
    mount();
    start();
    await settle();
    const first = frames()[0]!;
    next().click();
    await settle();
    expect(first.isConnected).toBe(false);
    expect(windows()).toHaveLength(1);
    expect(frames()[0]).not.toBe(first);
    expect(marked()).toEqual(frames());
  });

  it('closes the old window at once but waits for the flip to open the next', async () => {
    mount();
    start();
    await settle();
    const first = frames()[0]!;
    setFlipping(true);
    next().click();
    await settle();
    expect(first.isConnected).toBe(false);
    expect(windows()).toHaveLength(0);
    await endFlip();
    expect(windows()).toHaveLength(1);
  });

  describe('Q35: folded drawer on mobile', () => {
    const state = (): string | null => frames()[0]!.getAttribute(MARKER);
    const block = (): Element =>
      frames()[0]!.querySelector("[role='combobox']")!.parentElement!.parentElement!;
    const tap = (el: Element): void => (el as HTMLElement).click();
    const titleEl = (): Element => block().querySelector(':scope > p')!;

    it('arrives folded, unfolds on a tap, and only the title folds it back', async () => {
      mount();
      start();
      await settle();
      expect(state()).toBe('');
      tap(titleEl());
      expect(state()).toBe('open');
      tap(block().querySelector("[role='option'] button")!);
      expect(state()).toBe('open');
      tap(titleEl());
      expect(state()).toBe('');
    });

    it('folds on a tap outside the drawer', async () => {
      mount();
      start();
      await settle();
      tap(titleEl());
      tap(document.querySelector('main span.font-bold')!);
      expect(state()).toBe('');
    });

    it('unfolds on a tap on the card, which never reaches the site', async () => {
      mount();
      start();
      await settle();
      const site = vi.fn();
      card().addEventListener('click', site);
      tap(card());
      expect(state()).toBe('open');
      expect(site).not.toHaveBeenCalled();
      expect(windows()).toHaveLength(1);
    });

    it('unfolds on a tap that lands on the card container, as with pointer capture', async () => {
      mount();
      start();
      await settle();
      tap(flip());
      expect(state()).toBe('open');
    });

    it('folds again on the next card', async () => {
      mount();
      start();
      await settle();
      tap(titleEl());
      expect(state()).toBe('open');
      next().click();
      await settle();
      expect(state()).toBe('');
    });

    it('ignores taps on desktop', async () => {
      window.matchMedia = vi.fn((q: string) => ({ matches: true, media: q })) as never;
      mount();
      start();
      await settle();
      tap(titleEl());
      expect(state()).toBe('');
      Reflect.deleteProperty(window, 'matchMedia');
    });

    it('leaves a window of the player untouched', async () => {
      mount();
      const own = openWindow();
      start();
      await settle();
      tap(
        own
          .querySelector("[role='combobox']")!
          .parentElement!.parentElement!.querySelector(':scope > p')!,
      );
      expect(own.querySelector(`[${MARKER}]`)).toBeNull();
      expect(own.firstElementChild!.hasAttribute(MARKER)).toBe(false);
    });
  });

  it('closes our window when the reveal view goes away', async () => {
    mount();
    start();
    await settle();
    flip().remove();
    await settle();
    expect(windows()).toHaveLength(0);
  });

  it('closes our window on stop and clears the marker', async () => {
    mount();
    start();
    await settle();
    stop();
    expect(windows()).toHaveLength(0);
    expect(marked()).toHaveLength(0);
  });

  it('never closes a window of the player on a card change', async () => {
    mount();
    const own = openWindow();
    start();
    await settle();
    next().click();
    await settle();
    expect(windows()).toEqual([own]);
    stop();
    expect(windows()).toEqual([own]);
  });

  it('does nothing when the feature is off', async () => {
    await setFeature('tag-reveal', false);
    mount();
    start();
    await settle();
    expect(windows()).toHaveLength(0);
    expect(VARS.map((name) => document.documentElement.style.getPropertyValue(name))).toEqual([
      '',
      '',
      '',
    ]);
  });

  it('opens nothing when tag-menu is off', async () => {
    await setFeature('tag-menu', false);
    mount();
    start();
    await settle();
    expect(windows()).toHaveLength(0);
    expect(marked()).toHaveLength(0);
  });

  it('closes our window when tag-menu is turned off, and reopens when back on', async () => {
    mount();
    start();
    await settle();
    expect(windows()).toHaveLength(1);
    await setFeature('tag-menu', false);
    await settle();
    expect(windows()).toHaveLength(0);
    expect(marked()).toHaveLength(0);
    await setFeature('tag-menu', true);
    await settle();
    expect(windows()).toHaveLength(1);
  });

  it('leaves a window of the player alone when tag-menu is turned off', async () => {
    mount();
    const own = openWindow();
    start();
    await settle();
    await setFeature('tag-menu', false);
    await settle();
    expect(windows()).toEqual([own]);
  });

  it('opens nothing on a page without a revealed card', async () => {
    document.body.innerHTML = '<main><p>Ouvrir un paquet</p></main>';
    start();
    await settle();
    expect(windows()).toHaveLength(0);
  });

  describe('card rect', () => {
    const rect = { top: 100, right: 420, height: 420 };
    const values = (): string[] =>
      VARS.map((name) => document.documentElement.style.getPropertyValue(name));

    beforeEach(() => {
      Object.assign(rect, { top: 100, right: 420, height: 420 });
      mount();
      vi.spyOn(card(), 'getBoundingClientRect').mockImplementation(() => rect as DOMRect);
    });

    it('sets the custom properties on html', async () => {
      start();
      await settle();
      expect(values()).toEqual(['100px', '420px', '15']);
    });

    it('updates them on resize', async () => {
      start();
      await settle();
      rect.right = 500;
      window.dispatchEvent(new Event('resize'));
      expect(values()).toEqual(['100px', '500px', '15']);
    });

    // Measured block: 122 px outside the list, 36 px rows
    const measure = (): number => {
      const list = document.querySelector(`[${MARKER}] ul[role='listbox']`)!;
      const block = list.parentElement!.parentElement!;
      const count = list.children.length;
      for (const item of list.children)
        vi.spyOn(item, 'getBoundingClientRect').mockReturnValue({ height: 36 } as DOMRect);
      vi.spyOn(list, 'getBoundingClientRect').mockReturnValue({ height: 36 * 3 } as DOMRect);
      Object.defineProperty(block, 'scrollHeight', { configurable: true, value: 122 + 36 * 3 });
      return count;
    };

    it('keeps one column aligned on the card when every tag fits on screen', async () => {
      vi.stubGlobal('innerHeight', 2000);
      start();
      await settle();
      const count = measure();
      window.dispatchEvent(new Event('resize'));
      expect(values()).toEqual(['100px', '420px', String(count)]);
    });

    it('raises the single column so that it ends 1rem above the screen bottom', async () => {
      start();
      await settle();
      const count = measure();
      vi.stubGlobal('innerHeight', 40 + 122 + count * 36 + 16);
      window.dispatchEvent(new Event('resize'));
      expect(values()).toEqual(['40px', '420px', String(count)]);
    });

    it('keeps one column when a taller first item, the Wikidata hint, still fits', async () => {
      start();
      await settle();
      const count = measure();
      const list = document.querySelector(`[${MARKER}] ul[role='listbox']`)!;
      vi.spyOn(list.firstElementChild!, 'getBoundingClientRect').mockReturnValue({
        height: 56,
      } as DOMRect);
      vi.stubGlobal('innerHeight', 16 + 122 + 56 + (count - 1) * 36 + 16);
      window.dispatchEvent(new Event('resize'));
      expect(values()).toEqual(['16px', '420px', String(count)]);
    });

    it('counts the margin under the Wikidata hint', async () => {
      start();
      await settle();
      const count = measure();
      const list = document.querySelector(`[${MARKER}] ul[role='listbox']`)!;
      (list.firstElementChild as HTMLElement).style.marginBottom = '4px';
      vi.stubGlobal('innerHeight', 16 + 122 + 4 + count * 36 + 16);
      window.dispatchEvent(new Event('resize'));
      expect(values()).toEqual(['16px', '420px', String(count)]);
    });

    it('splits into columns over the full height when one column cannot fit', async () => {
      start();
      await settle();
      const count = measure();
      vi.stubGlobal('innerHeight', 16 + 122 + 36 * 2 + 16);
      window.dispatchEvent(new Event('resize'));
      expect(count).toBeGreaterThan(2);
      expect(values()).toEqual(['16px', '420px', '2']);
    });

    it('removes them on stop', async () => {
      start();
      await settle();
      stop();
      expect(values()).toEqual(['', '', '']);
    });

    it('removes them when the reveal view goes away', async () => {
      start();
      await settle();
      flip().remove();
      await settle();
      expect(values()).toEqual(['', '', '']);
    });
  });

  describe('R4: only the card and our Fermer button are clicked', () => {
    it('clicks the card, then Fermer of our window, and dispatches nothing', async () => {
      mount();
      const click = vi.spyOn(HTMLElement.prototype, 'click');
      const dispatch = vi.spyOn(EventTarget.prototype, 'dispatchEvent');
      start();
      await settle();
      const close = (win: Element): Element => win.querySelector('button[aria-label="Fermer"]')!;
      const first = close(frames()[0]!);
      advance();
      await settle();
      const second = close(frames()[0]!);
      stop();
      expect(click.mock.contexts).toEqual([card(), first, card(), second]);
      expect(
        (click.mock.contexts as HTMLElement[]).filter((el) =>
          el.closest('[role="option"], [aria-label^="Retirer"]'),
        ),
      ).toEqual([]);
      expect(dispatch).not.toHaveBeenCalled();
    });
  });
});
