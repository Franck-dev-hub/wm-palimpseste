import { fakeBrowser } from '@webext-core/fake-browser';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import masse from '../fixtures/modale-masse.html?raw';
import resultat from '../fixtures/modale-masse-resultat.html?raw';
import retirer from '../fixtures/modale-retirer.html?raw';
import { anchors } from '../../src/content/dom/anchors';
import { query, queryAll } from '../../src/content/dom/query';
import { starters } from '../../src/content/features';
import { startRunner } from '../../src/content/runner';
import { ext } from '../../src/shared/ext';
import { features } from '../../src/shared/features';
import { setFeature } from '../../src/shared/settings';

const flush = async (): Promise<void> => {
  await vi.advanceTimersByTimeAsync(0);
};

const options = (): HTMLElement[] => queryAll(anchors.bulkTagOption) as HTMLElement[];
const option = (index: number): HTMLElement => {
  const found = options()[index];
  if (found === undefined) throw new Error(`No option ${index}`);
  return found;
};
const checks = (): Element[] => [...document.querySelectorAll('.wmpal-bulk-check')];
const status = (): Element | null => document.querySelector('[role="status"]');

// Bypasses the dispatchEvent spy
const nativeDispatch: unknown = Reflect.get(EventTarget.prototype, 'dispatchEvent');
const nativeClick = (target: Element): MouseEvent => {
  const event = new MouseEvent('click', { bubbles: true, cancelable: true });
  Reflect.apply(nativeDispatch as () => boolean, target, [event]);
  return event;
};

// The site replaces the modal content in place
const showResult = async (): Promise<void> => {
  const frame = document.querySelector('.card-frame')!;
  const next = new DOMParser().parseFromString(resultat, 'text/html').querySelector('.card-frame')!;
  frame.replaceChildren(...next.childNodes);
  await flush();
};

let stop = (): void => undefined;
const start = async (html: string): Promise<void> => {
  document.body.innerHTML = html;
  stop = startRunner(features, starters);
  await flush();
};

beforeEach(() => {
  fakeBrowser.reset();
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
  vi.spyOn(ext.i18n, 'getMessage').mockImplementation((key) => `t:${key}`);
});

afterEach(() => {
  stop();
  document.body.innerHTML = '';
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('tag bulk check', () => {
  it('shows a check at once over the clicked option', async () => {
    await start(masse);
    nativeClick(option(1));
    const [check] = checks();
    expect(checks()).toHaveLength(1);
    expect(check!.hasAttribute('data-wmpal')).toBe(true);
    expect(option(1).contains(check!)).toBe(true);
    expect(check!.getAttribute('aria-hidden')).toBe('true');
    expect(check!.textContent).toBe('✓');
  });

  it('marks a click on the chip inside the option', async () => {
    await start(masse);
    nativeClick(option(0).querySelector('span')!);
    expect(option(0).querySelector('.wmpal-bulk-check')).not.toBeNull();
  });

  it('does not stack checks on a second click of the same option', async () => {
    await start(masse);
    nativeClick(option(0));
    nativeClick(option(0));
    expect(checks()).toHaveLength(1);
  });

  it('works in the remove variant', async () => {
    await start(retirer);
    nativeClick(option(0));
    expect(option(0).querySelector('.wmpal-bulk-check')).not.toBeNull();
  });

  it('shows no check on a Create row', async () => {
    await start(masse);
    const create = document.createElement('button');
    create.type = 'button';
    create.innerHTML =
      '<span>Créer</span><span style="background-color: rgba(1, 2, 3, 0.2)">Zoo</span>';
    option(0).parentElement!.append(create);
    nativeClick(create);
    expect(checks()).toEqual([]);
    vi.advanceTimersByTime(10_000);
    expect(status()).toBeNull();
  });

  it('ignores a click outside the options', async () => {
    await start(masse);
    nativeClick(document.querySelector('h2')!);
    nativeClick(query(anchors.bulkTagSearch)!);
    expect(checks()).toEqual([]);
  });

  it('removes the check when the result view shows, with no message', async () => {
    await start(masse);
    nativeClick(option(0));
    await showResult();
    expect(checks()).toEqual([]);
    vi.advanceTimersByTime(20_000);
    expect(status()).toBeNull();
  });

  it('removes the check when its button is detached', async () => {
    await start(masse);
    const button = option(0);
    nativeClick(button);
    button.remove();
    await flush();
    expect(checks()).toEqual([]);
    vi.advanceTimersByTime(20_000);
    expect(status()).toBeNull();
  });

  it('rolls back at 10 s with a message shown for 2 s', async () => {
    await start(masse);
    nativeClick(option(0));
    vi.advanceTimersByTime(9_999);
    expect(checks()).toHaveLength(1);
    expect(status()).toBeNull();
    vi.advanceTimersByTime(1);
    expect(checks()).toEqual([]);
    expect(status()!.textContent).toBe('t:tagMenuFailed');
    expect(status()!.hasAttribute('data-wmpal')).toBe(true);
    expect(document.querySelector('.card-frame')!.contains(status())).toBe(true);
    vi.advanceTimersByTime(1_999);
    expect(status()).not.toBeNull();
    vi.advanceTimersByTime(1);
    expect(status()).toBeNull();
  });

  it('shows one message when several options time out', async () => {
    await start(masse);
    nativeClick(option(0));
    nativeClick(option(1));
    vi.advanceTimersByTime(10_000);
    expect(document.querySelectorAll('[role="status"]')).toHaveLength(1);
  });

  it('cancels everything when the modal closes', async () => {
    await start(masse);
    nativeClick(option(0));
    document.body.innerHTML = '';
    await flush();
    vi.advanceTimersByTime(20_000);
    expect(checks()).toEqual([]);
    expect(status()).toBeNull();
    expect(vi.getTimerCount()).toBe(0);
  });

  it('cancels the message when the modal closes', async () => {
    await start(masse);
    nativeClick(option(0));
    vi.advanceTimersByTime(10_000);
    document.body.innerHTML = '';
    await flush();
    expect(status()).toBeNull();
    expect(vi.getTimerCount()).toBe(0);
  });

  it('cleans checks, messages and timers on stop', async () => {
    await start(masse);
    nativeClick(option(0));
    nativeClick(option(1));
    vi.advanceTimersByTime(5_000);
    nativeClick(option(2));
    stop();
    expect(checks()).toEqual([]);
    expect(vi.getTimerCount()).toBe(0);
    await start(masse);
    nativeClick(option(0));
    vi.advanceTimersByTime(10_000);
    stop();
    expect(status()).toBeNull();
    expect(vi.getTimerCount()).toBe(0);
  });

  it('does nothing after stop', async () => {
    await start(masse);
    stop();
    nativeClick(option(0));
    expect(checks()).toEqual([]);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('does nothing with the feature off', async () => {
    await setFeature('tag-menu', false);
    await start(masse);
    nativeClick(option(0));
    expect(checks()).toEqual([]);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('never clicks nor dispatches, and leaves the click untouched', async () => {
    const click = vi.spyOn(HTMLElement.prototype, 'click');
    const dispatch = vi.spyOn(EventTarget.prototype, 'dispatchEvent');
    await start(masse);
    dispatch.mockClear();
    const seen: boolean[] = [];
    document.body.addEventListener('click', (event) => {
      seen.push(event.defaultPrevented);
    });
    const event = nativeClick(option(0));
    expect(checks()).toHaveLength(1);
    expect(event.defaultPrevented).toBe(false);
    expect(seen).toEqual([false]);
    expect(click).not.toHaveBeenCalled();
    expect(dispatch).not.toHaveBeenCalled();
  });
});
