import { fakeBrowser } from '@webext-core/fake-browser';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import ouvert from '../fixtures/modale-menu-ouvert.html?raw';
import { anchors } from '../../src/content/dom/anchors';
import { query, queryAll } from '../../src/content/dom/query';
import { starters } from '../../src/content/features';
import { startRunner } from '../../src/content/runner';
import { contentMessageKeys } from '../../src/content/tag-pending';
import { ext } from '../../src/shared/ext';
import { features } from '../../src/shared/features';
import { setFeature } from '../../src/shared/settings';

const CREATE = `<li role="option" aria-selected="false"><div><button type="button"><span>Créer</span><span>Nouveau</span></button><label><input type="color"></label></div></li>`;

const flush = async (): Promise<void> => {
  await vi.advanceTimersByTimeAsync(0);
};

const combobox = (): HTMLInputElement => query(anchors.tagCombobox) as HTMLInputElement;
const block = (): Element => combobox().parentElement!.parentElement!;
const chipsBox = (): Element | null => {
  const box = combobox().parentElement!.previousElementSibling;
  return box?.tagName === 'DIV' && !box.hasAttribute('data-wmpal') ? box : null;
};
const option = (name: string): HTMLElement =>
  queryAll(anchors.tagOption)
    .find((li) => li.textContent.includes(name))!
    .querySelector('button')!;
const click = (el: HTMLElement): void => el.click();
const pending = (): Element[] => [...document.querySelectorAll('.wmpal-pending-chip')];
const status = (): Element | null => document.querySelector('[role="status"]');

const posed = (name: string): void => {
  let box = chipsBox();
  if (box === null) {
    box = document.createElement('div');
    combobox().parentElement!.before(box);
  }
  const chip = document.createElement('span');
  chip.innerHTML = `${name}<button type="button" aria-label="Retirer l'étiquette ${name}">×</button>`;
  box.append(chip);
};

let stop = (): void => undefined;
const start = async (): Promise<void> => {
  stop = startRunner(features, starters);
  await flush();
};

beforeEach(() => {
  fakeBrowser.reset();
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
  vi.spyOn(ext.i18n, 'getMessage').mockImplementation((key) => `t:${key}`);
  document.body.innerHTML = ouvert;
});

afterEach(() => {
  stop();
  document.body.innerHTML = '';
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('tag pending chip', () => {
  it('exports its message key', () => {
    expect(contentMessageKeys).toEqual(['tagMenuFailed']);
  });

  it('shows a provisional chip with the dot color and hides the row on a native click', async () => {
    await start();
    click(option('Animaux'));
    await flush();
    const [chip] = pending();
    expect(chip!.textContent).toBe('Animaux');
    expect(chip!.hasAttribute('data-wmpal')).toBe(true);
    expect(chipsBox()!.contains(chip!)).toBe(true);
    expect(chip!.querySelector<HTMLElement>('[aria-hidden]')!.style.backgroundColor).toBe(
      'rgb(74, 222, 128)',
    );
    expect(block().getAttribute('data-wmpal-pending')).toBe('Animaux');
    expect(option('Animaux').closest('li')!.hasAttribute('data-wmpal-pending-row')).toBe(true);
    expect(option('Art').closest('li')!.hasAttribute('data-wmpal-pending-row')).toBe(false);
  });

  it('does not cancel or stop the native click', async () => {
    await start();
    const seen: Event[] = [];
    document.body.addEventListener('click', (event) => seen.push(event));
    click(option('Animaux'));
    expect(seen).toHaveLength(1);
    expect(seen[0]!.defaultPrevented).toBe(false);
  });

  it('replaces the provisional chip by the native one and drops its timer', async () => {
    await start();
    click(option('Animaux'));
    await flush();
    posed('Animaux');
    await flush();
    expect(pending()).toHaveLength(0);
    expect(block().hasAttribute('data-wmpal-pending')).toBe(false);
    expect(vi.getTimerCount()).toBe(0);
    await vi.advanceTimersByTimeAsync(20_000);
    expect(status()).toBeNull();
  });

  it('rolls back after 10 s, with a message for 2 s', async () => {
    await start();
    click(option('Animaux'));
    await flush();
    await vi.advanceTimersByTimeAsync(9_999);
    expect(pending()).toHaveLength(1);
    await vi.advanceTimersByTimeAsync(1);
    expect(pending()).toHaveLength(0);
    expect(option('Animaux').closest('li')!.hasAttribute('data-wmpal-pending-row')).toBe(false);
    expect(block().hasAttribute('data-wmpal-pending')).toBe(false);
    expect(status()!.textContent).toBe('t:tagMenuFailed');
    await vi.advanceTimersByTimeAsync(1_999);
    expect(status()).not.toBeNull();
    await vi.advanceTimersByTimeAsync(1);
    expect(status()).toBeNull();
    expect(vi.getTimerCount()).toBe(0);
  });

  it('skips the Créer option', async () => {
    await start();
    query(anchors.tagListbox)!.insertAdjacentHTML('beforeend', CREATE);
    click(document.querySelector('input[type="color"]')!.closest('li')!.querySelector('button')!);
    await flush();
    expect(pending()).toHaveLength(0);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('skips a tag already posed', async () => {
    await start();
    posed('Art');
    await flush();
    click(option('Art'));
    await flush();
    expect(pending()).toHaveLength(0);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('gives two poses two chips, one timer each, and one chip per name', async () => {
    await start();
    click(option('Animaux'));
    click(option('Art'));
    click(option('Art'));
    await flush();
    expect(pending().map((chip) => chip.textContent)).toEqual(['Animaux', 'Art']);
    expect(vi.getTimerCount()).toBe(2);
    posed('Art');
    await flush();
    expect(pending().map((chip) => chip.textContent)).toEqual(['Animaux']);
    expect(vi.getTimerCount()).toBe(1);
  });

  it('puts a sibling owned by the extension before the combobox when there is no chip', async () => {
    chipsBox()!.remove();
    await start();
    const before = block().children.length;
    click(option('Animaux'));
    await flush();
    const zone = pending()[0]!.parentElement!;
    expect(zone.hasAttribute('data-wmpal')).toBe(true);
    expect(zone.parentElement).toBe(block());
    expect(zone.nextElementSibling).toBe(combobox().parentElement);
    expect(block().children.length).toBe(before + 1);
    posed('Animaux');
    await flush();
    expect(pending()).toHaveLength(0);
    expect(zone.isConnected).toBe(false);
  });

  it('shares one provisional zone between quick poses and removes it once empty', async () => {
    chipsBox()!.remove();
    await start();
    const before = block().children.length;
    click(option('Animaux'));
    click(option('Art'));
    await flush();
    const zones = block().querySelectorAll('.wmpal-pending-zone');
    expect(zones).toHaveLength(1);
    expect(block().children.length).toBe(before + 1);
    expect(zones[0]!.children).toHaveLength(2);
    posed('Animaux');
    await flush();
    expect(zones[0]!.isConnected).toBe(true);
    expect(pending().map((chip) => chip.textContent)).toEqual(['Art']);
    await vi.advanceTimersByTimeAsync(10_000);
    expect(pending()).toHaveLength(0);
    expect(zones[0]!.isConnected).toBe(false);
  });

  it('cancels everything when the modal closes', async () => {
    await start();
    click(option('Animaux'));
    await flush();
    document.body.innerHTML = '';
    await flush();
    expect(vi.getTimerCount()).toBe(0);
    await vi.advanceTimersByTimeAsync(20_000);
    expect(status()).toBeNull();
  });

  it('cleans pending nodes, rows and messages on stop', async () => {
    await start();
    click(option('Animaux'));
    await flush();
    await vi.advanceTimersByTimeAsync(10_000);
    click(option('Art'));
    await flush();
    expect(status()).not.toBeNull();
    stop();
    expect(pending()).toHaveLength(0);
    expect(status()).toBeNull();
    expect(document.querySelector('[data-wmpal]')).toBeNull();
    expect(document.querySelector('[data-wmpal-pending], [data-wmpal-pending-row]')).toBeNull();
    expect(vi.getTimerCount()).toBe(0);
  });

  it('does nothing with the feature off', async () => {
    await setFeature('tag-menu', false);
    await start();
    click(option('Animaux'));
    await flush();
    expect(pending()).toHaveLength(0);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('does nothing when a native chip is removed', async () => {
    await start();
    chipsBox()!.firstElementChild!.remove();
    await flush();
    expect(pending()).toHaveLength(0);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('only listens: no click and no dispatched event of its own', async () => {
    await start();
    const click = vi.spyOn(HTMLElement.prototype, 'click');
    const dispatch = vi.spyOn(EventTarget.prototype, 'dispatchEvent');
    option('Animaux').dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await flush();
    await vi.advanceTimersByTimeAsync(10_000);
    expect(pending()).toHaveLength(0);
    expect(dispatch).toHaveBeenCalledTimes(1);
    expect(click).not.toHaveBeenCalled();
  });
});
