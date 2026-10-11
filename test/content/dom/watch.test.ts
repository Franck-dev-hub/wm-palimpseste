import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import collection from '../../fixtures/collection.html?raw';
import modale from '../../fixtures/modale.html?raw';
import revele from '../../fixtures/revele.html?raw';
import { anchors } from '../../../src/content/dom/anchors';
import { mark, queryAll } from '../../../src/content/dom/query';
import { scan, watch } from '../../../src/content/dom/watch';

const stops: (() => void)[] = [];
const start = (...args: Parameters<typeof watch>): (() => void) => {
  const stop = watch(...args);
  stops.push(stop);
  return stop;
};
const inject =
  (feature: string) =>
  (el: Element): void => {
    const node = document.createElement('span');
    mark(node, feature);
    el.append(node);
  };

const frame = async (): Promise<void> => {
  await Promise.resolve();
  await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
};
const addCard = (): void => {
  const card = document.querySelector('div.rounded-2xl[class*="glow-"]');
  card?.parentElement?.append(card.cloneNode(true));
};

beforeEach(() => {
  document.body.innerHTML = collection;
});

afterEach(() => {
  for (const stop of stops.splice(0)) stop();
  document.body.innerHTML = '';
  vi.restoreAllMocks();
});

describe('watch', () => {
  it('injects once per card on the initial scan', () => {
    start('card', 'demo', inject('demo'));

    expect(document.querySelectorAll('[data-wmpal="demo"]')).toHaveLength(2);
    scan();
    expect(document.querySelectorAll('[data-wmpal="demo"]')).toHaveLength(2);
  });

  it('calls a handler that injects nothing once per element', () => {
    const handler = vi.fn();
    start('card', 'demo', handler);
    scan();

    expect(handler).toHaveBeenCalledTimes(2);
  });

  it('calls the handler again when its node left the element', () => {
    const handler = vi.fn(inject('demo'));
    start('card', 'demo', handler);
    document.querySelector('[data-wmpal="demo"]')?.remove();
    scan();

    expect(handler).toHaveBeenCalledTimes(3);
    expect(document.querySelectorAll('[data-wmpal="demo"]')).toHaveLength(2);
  });

  it('does not call the handler while one of several nodes remains', () => {
    const handler = vi.fn((el: Element) => {
      inject('demo')(el);
      inject('demo')(el);
    });
    start('card', 'demo', handler);
    document.querySelector('[data-wmpal="demo"]')?.remove();
    scan();

    expect(handler).toHaveBeenCalledTimes(2);
  });

  it('tracks each feature on its own', () => {
    const first = vi.fn(inject('one'));
    const second = vi.fn(inject('two'));
    start('card', 'one', first);
    start('card', 'two', second);

    expect(first).toHaveBeenCalledTimes(2);
    expect(second).toHaveBeenCalledTimes(2);
  });

  it('does not count a card copy as injected because its modal was', () => {
    document.body.innerHTML = modale;
    const onCard = vi.fn(inject('demo'));
    start('modal', 'demo', inject('demo'));
    start('card', 'demo', onCard);

    expect(onCard).toHaveBeenCalledTimes(1);
  });

  it('stops calling the handler after unwatch', () => {
    const handler = vi.fn();
    const stop = start('card', 'demo', handler);
    stop();
    document.body.innerHTML = collection;
    scan();

    expect(handler).toHaveBeenCalledTimes(2);
  });

  it('logs a failing handler once per element and keeps the other features running', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const failing = vi.fn((el: Element) => {
      inject('broken')(el);
      throw new Error('boom');
    });
    start('card', 'broken', failing);
    const healthy = vi.fn(inject('ok'));
    start('card', 'ok', healthy);

    expect(healthy).toHaveBeenCalledTimes(2);
    expect(error).toHaveBeenCalledTimes(2);
    expect(error).toHaveBeenCalledWith('[Palimpseste] broken', expect.any(Error));

    addCard();
    await frame();

    expect(failing).toHaveBeenCalledTimes(3);
    expect(error).toHaveBeenCalledTimes(3);
    expect(healthy).toHaveBeenCalledTimes(3);
  });

  it('removes the nodes of the feature on unwatch and keeps the others', () => {
    start('card', 'keep', inject('keep'));
    const stop = start('card', 'gone', inject('gone'));
    stop();

    expect(document.querySelectorAll('[data-wmpal="gone"]')).toHaveLength(0);
    expect(document.querySelectorAll('[data-wmpal="keep"]')).toHaveLength(2);
  });

  it('keeps the nodes while another entry still watches the same feature', () => {
    document.body.innerHTML = modale;
    const stopModal = start('modal', 'demo', inject('demo'));
    start('card', 'demo', inject('demo'));
    stopModal();

    expect(document.querySelectorAll('[data-wmpal="demo"]')).toHaveLength(2);
  });

  it('does nothing on a second unwatch', () => {
    const stop = start('card', 'demo', inject('demo'));
    stop();
    start('card', 'demo', inject('demo'));
    stop();

    expect(document.querySelectorAll('[data-wmpal="demo"]')).toHaveLength(2);
  });

  it('skips the calls of an entry unwatched by an earlier handler in the same scan', () => {
    let stopB = (): void => undefined;
    const b = vi.fn();
    start('card', 'a', () => stopB());
    stopB = start('card', 'b', b);
    b.mockClear();
    addCard();
    scan();

    expect(b).not.toHaveBeenCalled();
  });

  it('stays silent on a page without anchor', () => {
    document.body.innerHTML = '<p>nothing</p>';
    const spies = (['info', 'log', 'warn', 'error'] as const).map((m) =>
      vi.spyOn(console, m).mockImplementation(() => undefined),
    );
    const handler = vi.fn();
    start('card', 'demo', handler);

    expect(handler).not.toHaveBeenCalled();
    for (const spy of spies) expect(spy).not.toHaveBeenCalled();
  });
});

describe('watch, observer', () => {
  it('scans once per frame for several batches of mutations', async () => {
    const handler = vi.fn();
    start('card', 'demo', handler);
    const raf = vi.spyOn(globalThis, 'requestAnimationFrame');

    addCard();
    await Promise.resolve();
    addCard();
    await Promise.resolve();

    expect(raf).toHaveBeenCalledTimes(1);
    await frame();
    expect(handler).toHaveBeenCalledTimes(4);
  });

  it('schedules no scan for a batch made only of our nodes', async () => {
    const raf = vi.spyOn(globalThis, 'requestAnimationFrame');
    start('card', 'demo', inject('demo'));
    await Promise.resolve();

    expect(raf).not.toHaveBeenCalled();
  });

  it('schedules no scan when unwatch removes our nodes', async () => {
    start('card', 'keep', vi.fn());
    const stop = start('card', 'gone', inject('gone'));
    await Promise.resolve();
    const raf = vi.spyOn(globalThis, 'requestAnimationFrame');
    stop();
    await Promise.resolve();

    expect(raf).not.toHaveBeenCalled();
  });

  it('still schedules a scan for a page mutation pending during unwatch', async () => {
    start('card', 'keep', vi.fn());
    const stop = start('card', 'gone', inject('gone'));
    const raf = vi.spyOn(globalThis, 'requestAnimationFrame');
    addCard();
    stop();

    expect(raf).toHaveBeenCalledTimes(1);
    await frame();
  });

  it('observes nothing before the first watch', () => {
    const observe = vi.spyOn(MutationObserver.prototype, 'observe');
    const raf = vi.spyOn(globalThis, 'requestAnimationFrame');
    addCard();

    expect(observe).not.toHaveBeenCalled();
    expect(raf).not.toHaveBeenCalled();
  });

  it('disconnects and cancels the pending frame on the last unwatch only', () => {
    const disconnect = vi.spyOn(MutationObserver.prototype, 'disconnect');
    const cancel = vi.spyOn(globalThis, 'cancelAnimationFrame');
    const first = start('card', 'one', vi.fn());
    const second = start('card', 'two', vi.fn());
    addCard();
    first();

    expect(disconnect).not.toHaveBeenCalled();
    second();
    expect(disconnect).toHaveBeenCalledTimes(1);
    expect(cancel).toHaveBeenCalledTimes(1);
  });

  it('observes and scans again on a watch after the last unwatch', () => {
    const observe = vi.spyOn(MutationObserver.prototype, 'observe');
    start('card', 'demo', vi.fn())();
    const handler = vi.fn();
    start('card', 'demo', handler);

    expect(observe).toHaveBeenCalledTimes(2);
    expect(handler).toHaveBeenCalledTimes(2);
  });

  it('throws on an invalid feature id before registering or observing anything', () => {
    const observe = vi.spyOn(MutationObserver.prototype, 'observe');
    const handler = vi.fn();

    expect(() => watch('card', 'bad"id', handler)).toThrow('Invalid feature id: "bad"id"');
    expect(handler).not.toHaveBeenCalled();
    expect(observe).not.toHaveBeenCalled();
  });

  it('calls the handlers of one card in registration order', () => {
    const order: string[] = [];
    start('card', 'one', () => order.push('one'));
    start('card', 'two', () => order.push('two'));
    order.length = 0;
    addCard();
    scan();

    expect(order).toEqual(['one', 'two']);
  });

  it('schedules no scan for a mutation inside our node', async () => {
    start('card', 'demo', inject('demo'));
    await Promise.resolve();
    const raf = vi.spyOn(globalThis, 'requestAnimationFrame');
    document.querySelector('[data-wmpal="demo"]')?.append(document.createElement('i'));
    await Promise.resolve();

    expect(raf).not.toHaveBeenCalled();
  });

  it('does not call the handler for a card removed before the frame', async () => {
    const handler = vi.fn();
    start('card', 'demo', handler);
    addCard();
    document.querySelectorAll(anchors.card).forEach((card) => card.remove());
    handler.mockClear();
    await frame();

    expect(handler).not.toHaveBeenCalled();
  });

  it('injects again when the page removes our node', async () => {
    start('card', 'demo', inject('demo'));
    await Promise.resolve();
    document.querySelector('[data-wmpal="demo"]')?.remove();
    await frame();

    expect(document.querySelectorAll('[data-wmpal="demo"]')).toHaveLength(2);
  });

  it('gives each nested anchor its own single injection', async () => {
    document.body.innerHTML = modale;
    start('modal', 'on-modal', inject('on-modal'));
    start('card', 'on-card', inject('on-card'));
    await frame();
    await frame();

    const modal = queryAll(anchors.modal);
    const card = queryAll(anchors.card);
    expect(modal).toHaveLength(1);
    expect(card).toHaveLength(1);
    expect(modal[0]?.querySelectorAll(':scope > [data-wmpal="on-modal"]')).toHaveLength(1);
    expect(card[0]?.querySelectorAll(':scope > [data-wmpal="on-card"]')).toHaveLength(1);
    expect(document.querySelectorAll('[data-wmpal="on-modal"]')).toHaveLength(1);
    expect(document.querySelectorAll('[data-wmpal="on-card"]')).toHaveLength(1);
  });

  it('marks the revealed card after a SPA navigation', async () => {
    start('revealed', 'demo', inject('demo'));
    history.pushState({}, '', '/autre');
    document.body.innerHTML = revele;
    await frame();

    const revealed = queryAll(anchors.revealed);
    expect(revealed).toHaveLength(1);
    expect(revealed[0]?.querySelectorAll('[data-wmpal="demo"]')).toHaveLength(1);
  });
});
