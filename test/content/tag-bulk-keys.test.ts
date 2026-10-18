import { fakeBrowser } from '@webext-core/fake-browser';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import modale from '../fixtures/modale.html?raw';
import masse from '../fixtures/modale-masse.html?raw';
import resultat from '../fixtures/modale-masse-resultat.html?raw';
import retirer from '../fixtures/modale-retirer.html?raw';
import { anchors } from '../../src/content/dom/anchors';
import { query, queryAll } from '../../src/content/dom/query';
import { starters } from '../../src/content/features';
import { startRunner } from '../../src/content/runner';
import { features } from '../../src/shared/features';
import { setFeature } from '../../src/shared/settings';

const settle = async (): Promise<void> => {
  await Promise.resolve();
  await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
};

const search = (): HTMLElement => query(anchors.bulkTagSearch) as HTMLElement;
const options = (): HTMLElement[] => queryAll(anchors.bulkTagOption) as HTMLElement[];

const option = (index: number): HTMLElement => {
  const found = options()[index];
  if (found === undefined) throw new Error(`No option ${index}`);
  return found;
};

const nativeDispatch: unknown = Reflect.get(EventTarget.prototype, 'dispatchEvent');
const press = (target: Element, key: string, init: KeyboardEventInit = {}): KeyboardEvent => {
  const event = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true, ...init });
  Reflect.apply(nativeDispatch as () => boolean, target, [event]);
  return event;
};

let stop = (): void => undefined;
const start = async (html: string): Promise<void> => {
  document.body.innerHTML = html;
  stop = startRunner(features, starters);
  await settle();
};

beforeEach(() => {
  fakeBrowser.reset();
});

afterEach(() => {
  stop();
  document.body.innerHTML = '';
  vi.restoreAllMocks();
});

describe('tag bulk keys', () => {
  it('moves from the field to the first option on ArrowDown', async () => {
    await start(masse);
    search().focus();
    const event = press(search(), 'ArrowDown');
    expect(document.activeElement).toBe(option(0));
    expect(event.defaultPrevented).toBe(true);
  });

  it('moves between options with ArrowDown and ArrowUp', async () => {
    await start(masse);
    option(0).focus();
    const down = press(option(0), 'ArrowDown');
    expect(document.activeElement).toBe(option(1));
    expect(down.defaultPrevented).toBe(true);
    const up = press(option(1), 'ArrowUp');
    expect(document.activeElement).toBe(option(0));
    expect(up.defaultPrevented).toBe(true);
  });

  it('stays on the last option on ArrowDown', async () => {
    await start(masse);
    const last = options().at(-1)!;
    last.focus();
    press(last, 'ArrowDown');
    expect(document.activeElement).toBe(last);
  });

  it('goes back to the field on ArrowUp from the first option', async () => {
    await start(masse);
    option(0).focus();
    press(option(0), 'ArrowUp');
    expect(document.activeElement).toBe(search());
  });

  it('leaves ArrowUp in the field to the browser', async () => {
    await start(masse);
    search().focus();
    const event = press(search(), 'ArrowUp');
    expect(document.activeElement).toBe(search());
    expect(event.defaultPrevented).toBe(false);
  });

  it('does not handle Enter and Space', async () => {
    await start(masse);
    option(0).focus();
    for (const key of ['Enter', ' ']) {
      const event = press(option(0), key);
      expect(event.defaultPrevented).toBe(false);
      expect(document.activeElement).toBe(option(0));
    }
  });

  it.each([{ altKey: true }, { ctrlKey: true }, { metaKey: true }, { shiftKey: true }])(
    'ignores a modifier %o',
    async (modifier) => {
      await start(masse);
      search().focus();
      const event = press(search(), 'ArrowDown', modifier);
      expect(document.activeElement).toBe(search());
      expect(event.defaultPrevented).toBe(false);
    },
  );

  it('ignores a composition', async () => {
    await start(masse);
    search().focus();
    const event = press(search(), 'ArrowDown', { isComposing: true });
    expect(document.activeElement).toBe(search());
    expect(event.defaultPrevented).toBe(false);
  });

  it('skips an option the filter removed', async () => {
    await start(masse);
    option(0).focus();
    const removed = option(1);
    removed.remove();
    press(option(0), 'ArrowDown');
    expect(document.activeElement).toBe(option(1));
    expect(document.activeElement).not.toBe(removed);
  });

  it('restarts from the first connected option when the focused one was removed', async () => {
    await start(masse);
    const gone = option(1);
    gone.focus();
    gone.remove();
    search().focus();
    press(search(), 'ArrowDown');
    expect(document.activeElement).toBe(option(0));
  });

  it('reaches a Create row added by the filter', async () => {
    await start(masse);
    const list = option(0).parentElement!;
    for (const option of options().slice(1)) option.remove();
    const create = document.createElement('button');
    create.type = 'button';
    create.textContent = 'Créer Zoo';
    list.append(create);
    option(0).focus();
    press(option(0), 'ArrowDown');
    expect(document.activeElement).toBe(create);
  });

  it('does nothing when the filter leaves no option', async () => {
    await start(masse);
    for (const option of options()) option.remove();
    search().focus();
    const event = press(search(), 'ArrowDown');
    expect(document.activeElement).toBe(search());
    expect(event.defaultPrevented).toBe(false);
  });

  it('works in the remove variant', async () => {
    await start(retirer);
    search().focus();
    press(search(), 'ArrowDown');
    expect(document.activeElement).toBe(option(0));
    press(option(0), 'ArrowDown');
    expect(document.activeElement).toBe(option(1));
    press(option(1), 'ArrowUp');
    press(option(0), 'ArrowUp');
    expect(document.activeElement).toBe(search());
  });

  it('does nothing in the result view', async () => {
    await start(resultat);
    const done = query('button:not([aria-label])') as HTMLElement;
    done.focus();
    const event = press(done, 'ArrowDown');
    expect(document.activeElement).toBe(done);
    expect(event.defaultPrevented).toBe(false);
  });

  it('does nothing in the detail modal', async () => {
    await start(modale);
    const combobox = query(anchors.tagCombobox) as HTMLElement;
    combobox.focus();
    const event = press(combobox, 'ArrowDown');
    expect(document.activeElement).toBe(combobox);
    expect(event.defaultPrevented).toBe(false);
  });

  it('only acts on the bulk modal when the detail modal is open too', async () => {
    await start(modale + masse);
    const combobox = query(anchors.tagCombobox) as HTMLElement;
    const detail = press(combobox, 'ArrowDown');
    expect(detail.defaultPrevented).toBe(false);
    search().focus();
    press(search(), 'ArrowDown');
    expect(document.activeElement).toBe(option(0));
  });

  it('does nothing after stop', async () => {
    await start(masse);
    stop();
    search().focus();
    const event = press(search(), 'ArrowDown');
    expect(document.activeElement).toBe(search());
    expect(event.defaultPrevented).toBe(false);
  });

  it('does nothing with the feature off', async () => {
    await setFeature('tag-menu', false);
    await start(masse);
    search().focus();
    press(search(), 'ArrowDown');
    expect(document.activeElement).toBe(search());
  });

  it('only calls focus: no click and no dispatched event', async () => {
    const click = vi.spyOn(HTMLElement.prototype, 'click');
    const dispatch = vi.spyOn(EventTarget.prototype, 'dispatchEvent');
    await start(masse);
    dispatch.mockClear();
    search().focus();
    press(search(), 'ArrowDown');
    press(option(0), 'ArrowDown');
    press(option(1), 'ArrowUp');
    press(option(0), 'ArrowUp');
    expect(document.activeElement).toBe(search());
    expect(click).not.toHaveBeenCalled();
    expect(dispatch).not.toHaveBeenCalled();
  });
});
