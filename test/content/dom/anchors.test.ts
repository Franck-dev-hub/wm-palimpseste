import { beforeEach, describe, expect, it } from 'vitest';
import collection from '../../fixtures/collection.html?raw';
import echanger from '../../fixtures/echanger.html?raw';
import historiqueEchange from '../../fixtures/historique-echange.html?raw';
import listbox from '../../fixtures/listbox.html?raw';
import modale from '../../fixtures/modale.html?raw';
import modaleMasse from '../../fixtures/modale-masse.html?raw';
import modaleMasseResultat from '../../fixtures/modale-masse-resultat.html?raw';
import modaleMenuOuvert from '../../fixtures/modale-menu-ouvert.html?raw';
import modaleRetirer from '../../fixtures/modale-retirer.html?raw';
import offreEchange from '../../fixtures/offre-echange.html?raw';
import revele from '../../fixtures/revele.html?raw';
import selection from '../../fixtures/selection.html?raw';
import {
  anchors,
  bulkModalOf,
  cardDescription,
  cardTags,
  closeButtonOf,
  hasImage,
  imageZone,
  inDetailModal,
  isCreateOption,
  isFlipping,
  isShiny,
  modalTitle,
  modalWikiLink,
  openModals,
  rarity,
  revealedCard,
  tagBlockOf,
  tagChipName,
  tagNames,
  tagOptionLabel,
  title,
} from '../../../src/content/dom/anchors';
import { mark } from '../../../src/content/dom/query';

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

describe('modal title', () => {
  const modalWith = (href: string, card = ''): Element => {
    document.body.innerHTML = `<div><a href="${href}"></a>${card}</div>`;
    return document.body.firstElementChild!;
  };

  it('reads the title of the modal link', () => {
    load(modale);

    expect(modalTitle(find('modal')!)).toBe('Sonja Haraldsen');
  });

  it('keeps the homonymy qualifier and turns _ into spaces', () => {
    const modal = modalWith(
      'https://fr.wikipedia.org/wiki/Mercredi_(s%C3%A9rie_t%C3%A9l%C3%A9vis%C3%A9e)',
    );

    expect(modalTitle(modal)).toBe('Mercredi (série télévisée)');
  });

  it('decodes an encoded href', () => {
    const modal = modalWith('https://fr.wikipedia.org/wiki/AC%2FDC');

    expect(modalTitle(modal)).toBe('AC/DC');
  });

  it('falls back to the card title, never the truncated h2, without a link', () => {
    document.body.innerHTML = `<div><h2>Sonja Hara…</h2><div class="rounded-2xl glow-l"><h3>Sonja Haraldsen</h3></div></div>`;

    expect(modalTitle(document.body.firstElementChild!)).toBe('Sonja Haraldsen');
  });

  it('falls back to the card title on a malformed escape', () => {
    const modal = modalWith(
      'https://fr.wikipedia.org/wiki/%E0%A4%A',
      '<div class="rounded-2xl glow-l"><h3>Sonja Haraldsen</h3></div>',
    );

    expect(modalTitle(modal)).toBe('Sonja Haraldsen');
  });

  it('is null without link nor card', () => {
    expect(modalTitle(document.createElement('div'))).toBeNull();
  });
});

describe('tag chips', () => {
  it('reads the names of the chips of the modal', () => {
    load(modale);

    expect(findAll('tagChip')).toHaveLength(1);
    expect(tagNames(find('modal')!)).toEqual(['Norvège']);
    expect(tagChipName(find('tagChip')!)).toBe('Norvège');
  });

  it('is empty without chip', () => {
    const modal = document.createElement('div');
    modal.innerHTML = '<p>Étiquettes</p>';

    expect(tagNames(modal)).toEqual([]);
  });

  it('reads nothing when the aria-label is not French', () => {
    load(modale);
    const button = document.querySelector('button[aria-label^="Retirer"]')!;
    button.setAttribute('aria-label', 'Remove tag Norvège');

    expect(find('tagChip')).toBeNull();
    expect(tagNames(find('modal')!)).toEqual([]);
    expect(tagChipName(button.parentElement!)).toBeNull();
  });
});

describe('tag listbox', () => {
  const [stateA, stateB] = listbox.split('<!-- Etat B').map((part) => part.trim());
  const options = (): Element[] => findAll('tagOption');

  it('tagListbox and tagOption match only inside the modal', () => {
    load(stateA!);
    expect(find('tagListbox')).toBeNull();

    load(`<div class="fixed inset-0 z-50"><div class="card-frame">${stateA}</div></div>`);
    expect(findAll('tagListbox')).toHaveLength(1);
    expect(options()).toHaveLength(5);
  });

  it('reads the option labels without the colour dot', () => {
    load(`<div class="fixed inset-0 z-50"><div class="card-frame">${stateA}</div></div>`);

    expect(options().map(tagOptionLabel)).toEqual([
      '31-09',
      'Animaux',
      'Art',
      'Arts martiaux',
      'Cinéma',
    ]);
    expect(options().some(isCreateOption)).toBe(false);
  });

  it('detects the Créer option and gives it no label', () => {
    load(`<div class="fixed inset-0 z-50"><div class="card-frame">${stateB}</div></div>`);
    const [create, ...rest] = options();

    expect(rest).toEqual([]);
    expect(isCreateOption(create!)).toBe(true);
    expect(tagOptionLabel(create!)).toBeNull();
  });

  it('detects Créer without relying on its French text', () => {
    load(`<div class="fixed inset-0 z-50"><div class="card-frame">${stateB}</div></div>`);
    const create = options()[0]!;
    create.querySelector('button > span')!.textContent = 'Create';

    expect(isCreateOption(create)).toBe(true);
  });

  it('gives no label to an option of unknown shape', () => {
    const option = document.createElement('li');
    option.innerHTML = '<span>Art</span>';

    expect(tagOptionLabel(option)).toBeNull();
  });
});

describe('card description', () => {
  it('reads the p after the h3, whitespace normalised', () => {
    load(modale);

    expect(cardDescription(find('card')!)).toBe(
      'reine de Norvège de 1991 à 2026, devenue reine mère de Norvège',
    );
  });

  it('is null without description', () => {
    const card = document.createElement('div');
    card.innerHTML = '<h3>Art</h3>';

    expect(cardDescription(card)).toBeNull();
  });
});

describe('card tags', () => {
  const cards = (): Element[] => [...document.querySelectorAll(anchors.card)];
  const withChips = (...names: string[]): Element => {
    load(collection);
    const [card] = cards();
    const box = card!.querySelector('div.flex-wrap[class~="pb-0.5"]')!;
    box.innerHTML = names
      .map((name) => `<span class="inline-block rounded-full">${name}</span>`)
      .join('');
    return card!;
  };

  it('reads the names of the chips of a collection card', () => {
    load(collection);
    expect(cardTags(cards()[0]!)).toEqual(['Norvège']);
  });

  it('is empty for a card without chip container', () => {
    load(collection);
    expect(cardTags(cards()[1]!)).toEqual([]);
  });

  it('reads several chips', () => {
    expect(cardTags(withChips('A', ' B '))).toEqual(['A', 'B']);
  });

  it('is unreadable when a chip shows an overflow', () => {
    expect(cardTags(withChips('A', '+2'))).toBeNull();
  });

  it('is unreadable when a chip is empty', () => {
    expect(cardTags(withChips('A', ''))).toBeNull();
  });

  it('is unreadable for a card of the detail modal', () => {
    load(modale);
    expect(cardTags(document.querySelector(anchors.card)!)).toBeNull();
  });

  it('is unreadable for an element that is not a card', () => {
    load(collection);
    expect(cardTags(document.body)).toBeNull();
  });
});

describe('tag combobox', () => {
  it('matches only the combobox of the detail modal', () => {
    load(modale);
    expect(findAll('tagCombobox')).toHaveLength(1);

    load(modaleMenuOuvert);
    expect(findAll('tagCombobox')).toHaveLength(1);

    for (const html of [modaleMasse, modaleRetirer, modaleMasseResultat, selection, collection]) {
      load(html);
      expect(find('tagCombobox')).toBeNull();
    }
  });

  it('tagBlockOf returns the Étiquettes block holding label, chips and combobox', () => {
    load(modale);
    const block = tagBlockOf(find('modal')!)!;

    expect(block.querySelector('p')?.textContent).toBe('Étiquettes');
    expect(block.contains(find('tagCombobox'))).toBe(true);
    expect(block.querySelector('div.relative')?.contains(find('tagCombobox'))).toBe(true);
  });

  it('tagBlockOf returns null without combobox', () => {
    load(modaleMasse);

    expect(tagBlockOf(find('bulkTagModal')!)).toBeNull();
  });

  it('tagBlockOf works with the listbox open', () => {
    load(modaleMenuOuvert);

    expect(tagBlockOf(find('modal')!)?.querySelector('ul[role="listbox"]')).not.toBeNull();
  });
});

describe('bulk tag modal', () => {
  it('matches the apply and the remove modals', () => {
    load(modaleMasse);
    expect(findAll('bulkTagModal')).toHaveLength(1);

    load(modaleRetirer);
    expect(findAll('bulkTagModal')).toHaveLength(1);
  });

  it('does not match the result view, the selection bar or the detail modal', () => {
    for (const html of [modaleMasseResultat, selection, modale, modaleMenuOuvert, collection]) {
      load(html);
      expect(find('bulkTagModal')).toBeNull();
      expect(find('bulkTagSearch')).toBeNull();
      expect(find('bulkTagOption')).toBeNull();
    }
  });

  it('matches the search input, without relying on text', () => {
    load(modaleMasse);
    const input = find('bulkTagSearch');
    expect(input).toBe(document.querySelector('input[maxlength="48"]'));

    input!.setAttribute('placeholder', 'Search or create a tag…');
    expect(find('bulkTagSearch')).toBe(input);
  });

  it('matches the option buttons only, not Fermer', () => {
    load(modaleMasse);
    const options = findAll('bulkTagOption');

    expect(options).toHaveLength(3);
    expect(options.map((option) => option.textContent)).toEqual(['31-09', 'Animaux', 'Art']);

    load(modaleRetirer);
    expect(findAll('bulkTagOption')).toHaveLength(2);
  });

  it('matches a Créer row, which stays a button', () => {
    load(modaleMasse);
    const list = find('bulkTagSearch')!.nextElementSibling!;
    list.innerHTML = '<button type="button"><span>Créer</span><span>Nouveau</span></button>';

    expect(findAll('bulkTagOption')).toHaveLength(1);
  });

  it('still matches the modal when the filter empties the list', () => {
    load(modaleRetirer);
    find('bulkTagSearch')!.nextElementSibling!.innerHTML = '';

    expect(findAll('bulkTagModal')).toHaveLength(1);
    expect(find('bulkTagOption')).toBeNull();
  });

  it('bulkModalOf returns the bulk modal around an element, else null', () => {
    load(modaleMasse);
    const modal = find('bulkTagModal');

    expect(bulkModalOf(find('bulkTagOption')!)).toBe(modal);
    expect(bulkModalOf(find('bulkTagSearch')!)).toBe(modal);

    load(modale);
    expect(bulkModalOf(find('tagCombobox')!)).toBeNull();

    load(selection);
    expect(bulkModalOf(document.querySelector('button')!)).toBeNull();
  });
});

describe('reveal helpers', () => {
  it('revealedCard is the card inside the flip wrapper', () => {
    load(revele);
    expect(revealedCard()).toBe(find('revealed')!.firstElementChild);
  });

  it('revealedCard is null without a revealed card or with two', () => {
    load(collection);
    expect(revealedCard()).toBeNull();
    load(revele + revele);
    expect(revealedCard()).toBeNull();
  });

  it('isFlipping sees a running flip animation only', () => {
    load(revele);
    const flip = find('revealed') as unknown as { getAnimations: () => unknown };
    const card = revealedCard()!;
    expect(isFlipping(card)).toBe(false);
    flip.getAnimations = () => [{ animationName: 'card-flip', playState: 'running' }];
    expect(isFlipping(card)).toBe(true);
    flip.getAnimations = () => [{ transitionProperty: 'transform', playState: 'running' }];
    expect(isFlipping(card)).toBe(false);
    flip.getAnimations = () => [{ animationName: 'card-flip', playState: 'finished' }];
    expect(isFlipping(card)).toBe(false);
  });

  it('modalClose is the first direct button of the card-frame, whatever its label', () => {
    for (const html of [modale, modaleMenuOuvert]) {
      load(html);
      const buttons = findAll('modalClose');
      expect(buttons).toHaveLength(1);
      expect(buttons[0]!.parentElement!.classList.contains('card-frame')).toBe(true);
      buttons[0]!.setAttribute('aria-label', 'Close');
      expect(findAll('modalClose')).toEqual(buttons);
    }
  });

  it('openModals and closeButtonOf find the window and its Fermer button', () => {
    load(modale);
    const modal = find('modal')!;
    expect(openModals()).toEqual([modal]);
    expect(closeButtonOf(modal)).toBe(find('modalClose'));
    find('modalClose')!.setAttribute('aria-label', 'Close');
    expect(closeButtonOf(modal)).toBe(find('modalClose'));
    expect(closeButtonOf(document.createElement('div'))).toBeNull();
  });
});
