import { fakeBrowser } from '@webext-core/fake-browser';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import modale from '../fixtures/modale.html?raw';
import ouvert from '../fixtures/modale-menu-ouvert.html?raw';
import { anchors } from '../../src/content/dom/anchors';
import { query } from '../../src/content/dom/query';
import { starters } from '../../src/content/features';
import { startRunner } from '../../src/content/runner';
import { features } from '../../src/shared/features';
import { setFeature } from '../../src/shared/settings';

const frame = async (): Promise<void> => {
  await Promise.resolve();
  await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
};

const settle = async (): Promise<void> => {
  await frame();
  await frame();
};

const setDesktop = (matches: boolean): void => {
  window.matchMedia = vi.fn((q: string) => ({ matches, media: q })) as never;
};

const combobox = (): HTMLInputElement => query(anchors.tagCombobox) as HTMLInputElement;
const chips = (): Element => combobox().parentElement!.previousElementSibling!;

const pose = (name: string): void => {
  let box = combobox().parentElement!.previousElementSibling;
  if (box?.tagName !== 'DIV') {
    box = document.createElement('div');
    combobox().parentElement!.before(box);
  }
  const chip = document.createElement('span');
  chip.innerHTML = `${name}<button type="button" aria-label="Retirer l'étiquette ${name}">×</button>`;
  box.append(chip);
  (document.activeElement as HTMLElement | null)?.blur();
};

let stop = (): void => undefined;
const start = (): void => {
  stop = startRunner(features, starters);
};

beforeEach(() => {
  fakeBrowser.reset();
  setDesktop(true);
});

afterEach(() => {
  stop();
  document.body.innerHTML = '';
  vi.restoreAllMocks();
});

describe('tag menu focus', () => {
  it('focuses the combobox once when the modal appears', async () => {
    document.body.innerHTML = modale;
    start();
    await settle();
    expect(document.activeElement).toBe(combobox());
  });

  it('does not refocus on a re-render of the same modal', async () => {
    document.body.innerHTML = modale;
    start();
    await settle();
    combobox().blur();
    const block = combobox().parentElement!;
    block.replaceWith(block.cloneNode(true));
    await settle();
    expect(document.activeElement).toBe(document.body);
  });

  it('never steals focus from another field', async () => {
    document.body.innerHTML = `<textarea id="other"></textarea>${modale}`;
    const other = document.getElementById('other')!;
    other.focus();
    start();
    await settle();
    expect(document.activeElement).toBe(other);
  });

  it('refocuses after a pose', async () => {
    document.body.innerHTML = ouvert;
    start();
    await settle();
    pose('Transport');
    await settle();
    expect(document.activeElement).toBe(combobox());
  });

  it('refocuses after the first pose when no chip was there', async () => {
    document.body.innerHTML = modale;
    start();
    await settle();
    chips().remove();
    await settle();
    pose('Transport');
    await settle();
    expect(document.activeElement).toBe(combobox());
  });

  it('does not refocus after a chip removal', async () => {
    document.body.innerHTML = modale;
    start();
    await settle();
    chips().firstElementChild!.remove();
    (document.activeElement as HTMLElement).blur();
    await settle();
    expect(document.activeElement).toBe(document.body);
  });

  it('does not refocus when the menu closes with the chip count unchanged', async () => {
    document.body.innerHTML = ouvert;
    start();
    await settle();
    query(anchors.tagListbox)!.remove();
    (document.activeElement as HTMLElement).blur();
    await settle();
    expect(document.activeElement).toBe(document.body);
  });

  it('does not refocus after a pose when another field has focus', async () => {
    document.body.innerHTML = `<textarea id="other"></textarea>${modale}`;
    start();
    await settle();
    pose('Transport');
    const other = document.getElementById('other')!;
    other.focus();
    await settle();
    expect(document.activeElement).toBe(other);
  });

  it('does nothing below 64rem', async () => {
    setDesktop(false);
    document.body.innerHTML = modale;
    start();
    await settle();
    expect(document.activeElement).toBe(document.body);
    pose('Transport');
    await settle();
    expect(document.activeElement).toBe(document.body);
  });

  it('reads the width when acting', async () => {
    document.body.innerHTML = modale;
    start();
    await settle();
    setDesktop(false);
    pose('Transport');
    await settle();
    expect(document.activeElement).toBe(document.body);
  });

  it('does nothing after stop', async () => {
    document.body.innerHTML = modale;
    start();
    await settle();
    pose('Transport');
    stop();
    await settle();
    expect(document.activeElement).toBe(document.body);
  });

  it('does nothing with the feature off', async () => {
    await setFeature('tag-menu', false);
    document.body.innerHTML = modale;
    start();
    await settle();
    expect(document.activeElement).toBe(document.body);
  });

  it('only calls focus: no click and no dispatched event', async () => {
    const click = vi.spyOn(HTMLElement.prototype, 'click');
    const dispatch = vi.spyOn(EventTarget.prototype, 'dispatchEvent');
    document.body.innerHTML = ouvert;
    start();
    await settle();
    pose('Transport');
    await settle();
    expect(document.activeElement).toBe(combobox());
    expect(click).not.toHaveBeenCalled();
    expect(dispatch).not.toHaveBeenCalled();
  });
});

describe('tag menu focus on a window opened by the reveal', () => {
  const MARK = 'data-wmpal-tag-reveal';
  const frameEl = (): Element => query(anchors.modal)!;
  const mount = (extra = ''): HTMLButtonElement => {
    document.body.innerHTML = `${extra}<button id="arrow">next</button>${ouvert}`;
    const arrow = document.getElementById('arrow') as HTMLButtonElement;
    arrow.focus();
    return arrow;
  };

  it('focuses the combobox although a button holds the focus', async () => {
    mount();
    frameEl().setAttribute(MARK, '');
    start();
    await settle();
    expect(document.activeElement).toBe(combobox());
  });

  it('focuses it when the marker lands after the window appeared', async () => {
    mount();
    start();
    frameEl().setAttribute(MARK, '');
    await settle();
    expect(document.activeElement).toBe(combobox());
  });

  it('keeps the rule for an unmarked window', async () => {
    const arrow = mount();
    start();
    await settle();
    expect(document.activeElement).toBe(arrow);
  });

  it('focuses below 64rem too', async () => {
    setDesktop(false);
    mount();
    frameEl().setAttribute(MARK, '');
    start();
    await settle();
    expect(document.activeElement).toBe(combobox());
  });

  it('focuses the combobox once the site enables it after loading', async () => {
    const arrow = mount();
    query(anchors.tagListbox)!.remove();
    const input = combobox();
    input.disabled = true;
    frameEl().setAttribute(MARK, '');
    start();
    await settle();
    expect(document.activeElement).toBe(arrow);
    input.disabled = false;
    await settle();
    expect(document.activeElement).toBe(input);
  });

  it('refocuses when the listbox disappears', async () => {
    mount();
    frameEl().setAttribute(MARK, '');
    start();
    await settle();
    query(anchors.tagListbox)!.remove();
    const arrow = document.getElementById('arrow') as HTMLButtonElement;
    arrow.focus();
    await settle();
    expect(document.activeElement).toBe(combobox());
  });

  it('does not refocus when another text field has the focus', async () => {
    mount('<textarea id="other"></textarea>');
    frameEl().setAttribute(MARK, '');
    start();
    await settle();
    query(anchors.tagListbox)!.remove();
    const other = document.getElementById('other')!;
    other.focus();
    await settle();
    expect(document.activeElement).toBe(other);
  });

  it('only calls focus on the field', async () => {
    const click = vi.spyOn(HTMLElement.prototype, 'click');
    const dispatch = vi.spyOn(EventTarget.prototype, 'dispatchEvent');
    mount();
    frameEl().setAttribute(MARK, '');
    start();
    await settle();
    expect(click).not.toHaveBeenCalled();
    expect(dispatch).not.toHaveBeenCalled();
  });
});
