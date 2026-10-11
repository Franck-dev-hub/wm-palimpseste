import { fakeBrowser } from '@webext-core/fake-browser';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import collection from '../../test/fixtures/collection.html?raw';
import echanger from '../../test/fixtures/echanger.html?raw';
import modale from '../../test/fixtures/modale.html?raw';
import revele from '../../test/fixtures/revele.html?raw';
import { ext } from '../shared/ext';
import { features } from '../shared/features';
import { setFeature } from '../shared/settings';
import { starters } from './features';
import { startRunner } from './runner';
import { anchors } from './dom/anchors';
import { query, queryAll } from './dom/query';
import { scan } from './dom/watch';
import { startWikipedia, wikipediaUrl } from './wikipedia';

const base = 'https://fr.wikipedia.org/wiki/';

describe('wikipediaUrl', () => {
  it.each([
    ['AC/DC', 'AC%2FDC'],
    ['Qui veut gagner des millions ?', 'Qui_veut_gagner_des_millions_%3F'],
    ['Procter & Gamble', 'Procter_%26_Gamble'],
    ['100 %', '100_%25'],
    ['C++', 'C%2B%2B'],
    ["L'Œuvre", "L'%C5%92uvre"],
    ['L’Œuvre', 'L%E2%80%99%C5%92uvre'],
    ['Mercredi (série télévisée)', 'Mercredi_(s%C3%A9rie_t%C3%A9l%C3%A9vis%C3%A9e)'],
  ])('encodes %s', (title, path) => {
    expect(wikipediaUrl(title)).toBe(base + path);
  });
});

// `document.links`: queryAll skips our nodes and querySelector is banned here.
const badges = (): Element[] =>
  [...document.links].filter((link) => link.classList.contains('wmpal-wiki'));
const badgesOf = (card: Element): Element[] =>
  [...card.children].filter((child) => child.classList.contains('wmpal-wiki'));

const frame = async (): Promise<void> => {
  await Promise.resolve();
  await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
};

let stop = (): void => undefined;

beforeEach(() => {
  vi.spyOn(ext.i18n, 'getMessage').mockImplementation((key) => `t:${key}`);
  document.body.innerHTML = collection;
});

afterEach(() => {
  stop();
  document.body.innerHTML = '';
  vi.restoreAllMocks();
});

describe('startWikipedia', () => {
  it('adds one badge per collection card, as the last child', () => {
    stop = startWikipedia();
    const cards = queryAll(anchors.card);

    expect(cards).toHaveLength(2);
    expect(badges()).toHaveLength(2);
    for (const card of cards) {
      expect(badgesOf(card)).toHaveLength(1);
      expect(card.lastElementChild).toBe(badgesOf(card)[0]);
    }
  });

  it('sets the attributes of a badge', () => {
    stop = startWikipedia();
    const badge = badges()[1];

    expect(badge?.tagName).toBe('A');
    expect(badge?.getAttribute('data-wmpal')).toBe('wikipedia');
    expect(badge?.textContent).toBe('W');
    expect(badge?.getAttribute('href')).toBe(
      'https://fr.wikipedia.org/wiki/Mercredi_(s%C3%A9rie_t%C3%A9l%C3%A9vis%C3%A9e)',
    );
    expect(badge?.getAttribute('target')).toBe('_blank');
    expect(badge?.getAttribute('rel')).toBe('noopener noreferrer');
    expect(badge?.getAttribute('title')).toBe('t:wikipediaOpen');
    expect(badge?.getAttribute('aria-label')).toBe('t:wikipediaOpen');
    expect(badge?.getAttribute('draggable')).toBe('false');
  });

  it('adds one badge to the revealed card', () => {
    document.body.innerHTML = revele;
    stop = startWikipedia();

    expect(queryAll(anchors.card).length).toBeGreaterThan(0);
    expect(badges()).toHaveLength(queryAll(anchors.card).length);
  });

  it('adds a badge to each of the 6 cards of the exchange screen, selected ones included', () => {
    document.body.innerHTML = echanger;
    stop = startWikipedia();

    expect(queryAll(anchors.card)).toHaveLength(6);
    expect(badges()).toHaveLength(6);
  });

  it('adds no badge in the detail modal', () => {
    document.body.innerHTML = modale;
    stop = startWikipedia();

    expect(badges()).toHaveLength(0);
  });

  it('adds no badge and logs nothing for a card without title', () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const card = queryAll(anchors.card)[0];
    const heading = query('h3', card ?? document);
    if (heading) heading.textContent = '';
    for (const img of queryAll('img[alt]', card ?? document))
      img.setAttribute('alt', 'WikiMasters');
    stop = startWikipedia();

    expect(badges()).toHaveLength(1);
    expect(card && badgesOf(card)).toHaveLength(0);
    expect(error).not.toHaveBeenCalled();
  });

  it('does not retry a card without title once its title appears', async () => {
    const card = queryAll(anchors.card)[0];
    const heading = query('h3', card ?? document);
    if (heading) heading.textContent = '';
    for (const img of queryAll('img[alt]', card ?? document))
      img.setAttribute('alt', 'WikiMasters');
    stop = startWikipedia();
    if (heading) heading.textContent = 'Nouveau titre';

    scan();
    await frame();

    expect(card && badgesOf(card)).toHaveLength(0);
    expect(badges()).toHaveLength(1);
  });

  it('adds one badge per card after the grid is replaced by a clone without badges', async () => {
    stop = startWikipedia();
    const grid = queryAll(anchors.card)[0]?.parentElement;
    const clone = grid?.cloneNode(true) as Element;
    for (const badge of [...clone.children].flatMap((card) => badgesOf(card))) badge.remove();
    grid?.replaceWith(clone);
    await frame();

    expect(queryAll(anchors.card)).toHaveLength(2);
    for (const card of queryAll(anchors.card)) expect(badgesOf(card)).toHaveLength(1);
    scan();
    expect(badges()).toHaveLength(2);
  });

  it('removes every badge when stopped', () => {
    startWikipedia()();

    expect(badges()).toHaveLength(0);
  });
});

describe('gestures on the badge', () => {
  const gestures: [string, (target: Element) => Event][] = [
    ['click', () => new MouseEvent('click', { bubbles: true, cancelable: true })],
    ['auxclick', () => new MouseEvent('auxclick', { bubbles: true, cancelable: true, button: 1 })],
    ['mousedown', () => new MouseEvent('mousedown', { bubbles: true, cancelable: true })],
    ['pointerdown', () => new PointerEvent('pointerdown', { bubbles: true, cancelable: true })],
    [
      'keydown',
      () => new KeyboardEvent('keydown', { bubbles: true, cancelable: true, key: 'Enter' }),
    ],
  ];

  it.each(gestures)('keeps %s away from document, without cancelling it', (_name, make) => {
    stop = startWikipedia();
    const seen = vi.fn();
    document.addEventListener(make(document.body).type, seen);
    const event = make(document.body);

    expect(badges()[0]?.dispatchEvent(event)).toBe(true);
    expect(event.defaultPrevented).toBe(false);
    expect(seen).not.toHaveBeenCalled();
    document.removeEventListener(event.type, seen);
  });

  it('keeps a click away from the <button> around a card', () => {
    document.body.innerHTML = echanger;
    stop = startWikipedia();
    const badge = badges()[0];
    let ancestor = badge?.parentElement ?? null;
    while (ancestor && ancestor.tagName !== 'BUTTON') ancestor = ancestor.parentElement;
    const onButton = vi.fn();
    const onDocument = vi.fn();
    ancestor?.addEventListener('click', onButton);
    document.addEventListener('click', onDocument);
    const event = new MouseEvent('click', { bubbles: true, cancelable: true });

    expect(ancestor?.tagName).toBe('BUTTON');
    expect(badge?.dispatchEvent(event)).toBe(true);
    expect(event.defaultPrevented).toBe(false);
    expect(onButton).not.toHaveBeenCalled();
    expect(onDocument).not.toHaveBeenCalled();
    document.removeEventListener('click', onDocument);
  });

  it('keeps a click away from the <a> around a card', () => {
    const card = queryAll(anchors.card)[0]!;
    const link = document.createElement('a');
    link.href = 'https://example.com/';
    card.replaceWith(link);
    link.append(card);
    stop = startWikipedia();
    const onLink = vi.fn();
    const onDocument = vi.fn();
    link.addEventListener('click', onLink);
    document.addEventListener('click', onDocument);
    const event = new MouseEvent('click', { bubbles: true, cancelable: true });

    expect(badgesOf(card)[0]?.dispatchEvent(event)).toBe(true);
    expect(event.defaultPrevented).toBe(false);
    expect(onLink).not.toHaveBeenCalled();
    expect(onDocument).not.toHaveBeenCalled();
    document.removeEventListener('click', onDocument);
  });

  it('keeps a pointerdown away from the flip ancestor of a revealed card', () => {
    document.body.innerHTML = revele;
    stop = startWikipedia();
    const flip = queryAll(anchors.revealed)[0]!;
    const onFlip = vi.fn();
    flip.addEventListener('pointerdown', onFlip);
    const badge = badges()[0];

    badge?.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, cancelable: true }));

    expect(onFlip).not.toHaveBeenCalled();
    expect(badge?.getAttribute('draggable')).toBe('false');
  });

  it('is focusable and labelled', () => {
    stop = startWikipedia();
    const badge = badges()[0] as HTMLElement;

    badge.focus();
    expect(document.activeElement).toBe(badge);
    expect(badge.getAttribute('aria-label')).toBe('t:wikipediaOpen');
    expect(badge.getAttribute('title')).toBe('t:wikipediaOpen');
  });
});

describe('href re-read on gesture', () => {
  const retitle = (card: Element, text: string): void => {
    const heading = query('h3', card);
    if (heading) heading.textContent = text;
  };
  const gestures: [string, Event][] = [
    ['pointerdown', new PointerEvent('pointerdown', { bubbles: true })],
    ['focus', new FocusEvent('focus')],
    ['keydown', new KeyboardEvent('keydown', { bubbles: true, key: 'Enter' })],
  ];

  it.each(gestures)('follows the new title on %s', (_name, event) => {
    stop = startWikipedia();
    const card = queryAll(anchors.card)[0]!;
    retitle(card, 'Nouveau titre');

    badgesOf(card)[0]?.dispatchEvent(event);

    expect(badgesOf(card)[0]?.getAttribute('href')).toBe(wikipediaUrl('Nouveau titre'));
  });

  it('keeps the href when the title is gone', () => {
    stop = startWikipedia();
    const card = queryAll(anchors.card)[0]!;
    const before = badgesOf(card)[0]?.getAttribute('href');
    retitle(card, '');
    for (const img of queryAll('img[alt]', card)) img.setAttribute('alt', 'WikiMasters');

    badgesOf(card)[0]?.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));

    expect(badgesOf(card)[0]?.getAttribute('href')).toBe(before);
  });
});

describe('through the runner', () => {
  const settled = (count: number) => vi.waitFor(() => expect(badges()).toHaveLength(count));

  beforeEach(() => {
    fakeBrowser.reset();
  });

  it('removes the badges when disabled and injects them once when enabled again', async () => {
    stop = startRunner(features, starters);
    await settled(2);

    await setFeature('wikipedia', false);
    await settled(0);

    await setFeature('wikipedia', true);
    await settled(2);
    for (const card of queryAll(anchors.card)) expect(badgesOf(card)).toHaveLength(1);

    const onDocument = vi.fn();
    document.addEventListener('click', onDocument);
    const event = new MouseEvent('click', { bubbles: true, cancelable: true });
    badges()[0]?.dispatchEvent(event);
    document.removeEventListener('click', onDocument);

    expect(event.defaultPrevented).toBe(false);
    expect(onDocument).not.toHaveBeenCalled();
  });

  it('removes every badge when the runner is disposed', async () => {
    stop = startRunner(features, starters);
    await settled(2);

    stop();

    expect(badges()).toHaveLength(0);
  });
});
