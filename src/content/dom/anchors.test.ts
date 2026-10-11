import { beforeEach, describe, expect, it } from 'vitest';
import collection from '../../../test/fixtures/collection.html?raw';
import echanger from '../../../test/fixtures/echanger.html?raw';
import historiqueEchange from '../../../test/fixtures/historique-echange.html?raw';
import modale from '../../../test/fixtures/modale.html?raw';
import offreEchange from '../../../test/fixtures/offre-echange.html?raw';
import revele from '../../../test/fixtures/revele.html?raw';
import {
  anchors,
  hasImage,
  imageZone,
  inDetailModal,
  isShiny,
  modalWikiLink,
  rarity,
  title,
} from './anchors';
import { mark } from './query';

// `?raw`, not `fs`: the root tsconfig has no Node types.
const load = (html: string): void => {
  document.body.innerHTML = html;
};
const find = (name: keyof typeof anchors): Element | null => document.querySelector(anchors[name]);
const findAll = (name: keyof typeof anchors): Element[] => [
  ...document.querySelectorAll(anchors[name]),
];

beforeEach(() => {
  document.body.innerHTML = '';
});

describe('anchors', () => {
  it('card matches both cards of the collection', () => {
    load(collection);

    expect(findAll('card')).toHaveLength(2);
  });

  it('card does not match trade pages, which have no glow root', () => {
    load(offreEchange);
    expect(find('card')).toBeNull();

    load(historiqueEchange);
    expect(find('card')).toBeNull();
  });

  it('card matches the card copy of the modal', () => {
    load(modale);

    expect(findAll('card')).toHaveLength(1);
  });

  it('modal matches the modal frame only', () => {
    load(modale);
    expect(findAll('modal')).toHaveLength(1);

    load(collection);
    expect(find('modal')).toBeNull();
  });

  it('revealed matches the flipped card of a pack opening only', () => {
    load(revele);
    expect(findAll('revealed')).toHaveLength(1);

    load(`<main>${collection}</main>`);
    expect(find('revealed')).toBeNull();
  });

  it('trade matches offer and history frames only', () => {
    load(offreEchange);
    expect(findAll('trade')).toHaveLength(1);

    load(historiqueEchange);
    expect(findAll('trade')).toHaveLength(1);

    load(collection);
    expect(find('trade')).toBeNull();
  });
});

describe('inDetailModal', () => {
  it('is true for the card of the detail modal', () => {
    load(modale);

    expect(inDetailModal(find('card')!)).toBe(true);
  });

  it('is false for the cards of the collection', () => {
    load(collection);

    expect(findAll('card').map(inDetailModal)).toEqual([false, false]);
  });

  it('is false for the cards of the exchange screen', () => {
    load(echanger);
    const cards = findAll('card');

    expect(cards).toHaveLength(6);
    expect(cards.map(inDetailModal)).toEqual(Array(6).fill(false));
  });

  it('is false for the revealed card', () => {
    load(revele);

    expect(inDetailModal(find('revealed')!.firstElementChild!)).toBe(false);
  });
});

describe('extractors', () => {
  it('rarity reads the glow class of each collection card', () => {
    load(collection);

    expect(findAll('card').map(rarity)).toEqual(['l', 'ur']);
  });

  it('rarity reads the glow class of a revealed card', () => {
    load(revele);

    expect(rarity(find('revealed')!.firstElementChild!)).toBe('c');
  });

  it('rarity is null without a known glow class', () => {
    const card = document.createElement('div');
    card.className = 'glow-shiny rounded-2xl';

    expect(rarity(card)).toBeNull();
  });

  it('isShiny is false on the fixtures and true with glow-shiny', () => {
    load(collection);
    const [card] = findAll('card');

    expect(isShiny(card!)).toBe(false);

    card!.classList.add('glow-shiny');

    expect(isShiny(card!)).toBe(true);
  });

  it('title reads the h3 of each collection card', () => {
    load(collection);

    expect(findAll('card').map(title)).toEqual(['Sonja Haraldsen', 'Mercredi (série télévisée)']);
  });

  it('title falls back to the image alt without h3', () => {
    const card = document.createElement('div');
    card.innerHTML = '<img alt="Sonja Haraldsen">';

    expect(title(card)).toBe('Sonja Haraldsen');
  });

  it.each(['', 'WikiMasters'])('title ignores the image alt "%s"', (alt) => {
    const card = document.createElement('div');
    card.innerHTML = `<img alt="${alt}">`;

    expect(title(card)).toBeNull();
  });
});

describe('image zone', () => {
  it('is a direct child of every card', () => {
    load(collection);
    for (const card of findAll('card')) expect(imageZone(card)?.parentElement).toBe(card);

    load(modale);
    expect(imageZone(find('card')!)).not.toBeNull();

    load(revele);
    expect(imageZone(find('revealed')!.firstElementChild!)).not.toBeNull();
  });

  it('hasImage tells the image card from the placeholder card', () => {
    load(collection);

    expect(findAll('card').map(hasImage)).toEqual([true, false]);
  });

  it('hasImage is false on the revealed card without image', () => {
    load(revele);

    expect(hasImage(find('revealed')!.firstElementChild!)).toBe(false);
  });

  it('hasImage is false without image zone', () => {
    expect(hasImage(document.createElement('div'))).toBe(false);
  });
});

describe('modal wiki link', () => {
  const SITE_LINK = 'https://fr.wikipedia.org/wiki/Sonja_Haraldsen';

  const fakeLink = (): HTMLAnchorElement => {
    const link = document.createElement('a');
    link.href = 'https://fr.wikipedia.org/wiki/Fake';
    return link;
  };

  it('is the site link of the modal', () => {
    load(modale);

    expect(modalWikiLink(find('modal')!)?.getAttribute('href')).toBe(SITE_LINK);
  });

  it('is null without a Wikipedia link', () => {
    expect(modalWikiLink(document.createElement('div'))).toBeNull();
  });

  it('ignores our marked link placed before the site link', () => {
    load(modale);
    const link = fakeLink();
    mark(link, 'wiki-link');
    find('card')!.prepend(link);

    expect(modalWikiLink(find('modal')!)?.getAttribute('href')).toBe(SITE_LINK);
  });

  it('ignores our link nested in a marked container', () => {
    load(modale);
    const container = document.createElement('div');
    container.append(fakeLink());
    mark(container, 'wiki-link');
    find('card')!.prepend(container);

    expect(modalWikiLink(find('modal')!)?.getAttribute('href')).toBe(SITE_LINK);
  });
});
