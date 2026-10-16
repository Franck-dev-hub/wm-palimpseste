import { fakeBrowser } from '@webext-core/fake-browser';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import listbox from '../fixtures/listbox.html?raw';
import modale from '../fixtures/modale.html?raw';
import { anchors, cardDescription } from '../../src/content/dom/anchors';
import { query, queryAll } from '../../src/content/dom/query';
import { scan } from '../../src/content/dom/watch';
import { starters } from '../../src/content/features';
import { startRunner } from '../../src/content/runner';
import { mentions, startTagHighlight } from '../../src/content/tag-highlight';
import { features } from '../../src/shared/features';
import { setFeature } from '../../src/shared/settings';

const [, stateA = '', stateB = ''] = listbox.split(/<!-- Etat [AB][^>]*-->/);

const frame = async (): Promise<void> => {
  await Promise.resolve();
  await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
};

const options = (): Element[] => queryAll(anchors.tagOption);
const highlighted = (): string[] =>
  options()
    .filter((option) => option.classList.contains('wmpal-in-description'))
    .map((option) => option.textContent.trim());

const open = (description: string, state = stateA): void => {
  document.body.innerHTML = modale;
  const card = query(anchors.card, query(anchors.modal)!)!;
  query('h3 ~ p', card)!.textContent = description;
  expect(cardDescription(card)).toBe(description);
  query(anchors.modal)!.insertAdjacentHTML('beforeend', state);
};

let stop = (): void => undefined;

beforeEach(() => {
  fakeBrowser.reset();
});

afterEach(() => {
  stop();
  document.body.innerHTML = '';
});

describe('mentions', () => {
  it.each([
    ['un film de cinéma, culte', 'Cinéma', true],
    ['un film de CINÉMA', 'Cinéma', true],
    ['un artiste connu', 'Art', false],
    ['son art est rare', 'Art', true],
    ['le cinema muet', 'Cinéma', false],
    ['arts martiaux japonais', 'Arts martiaux', true],
    ['a bb c', 'b+', false],
    ['le C++ est vieux', 'C++', true],
    ['cinéma', 'Cinéma', true],
  ])('%s / %s', (description, name, expected) => {
    expect(mentions(description, name)).toBe(expected);
  });
});

describe('startTagHighlight', () => {
  it('marks an option named in the description and leaves the others', () => {
    open('acteur de cinéma et de théâtre');
    stop = startTagHighlight();
    expect(highlighted()).toEqual(['Cinéma']);
  });

  it('matches whole words only', () => {
    open('un artiste et des animaux');
    stop = startTagHighlight();
    expect(highlighted()).toEqual(['Animaux']);
  });

  it('ignores the case of the description', () => {
    open('Réalisateur de CINÉMA');
    stop = startTagHighlight();
    expect(highlighted()).toEqual(['Cinéma']);
  });

  it('marks nothing when no option is named', () => {
    open('reine de Norvège');
    stop = startTagHighlight();
    expect(highlighted()).toEqual([]);
  });

  it('never marks the create option', () => {
    open('zzqx est cité ici, Créer aussi', stateB);
    stop = startTagHighlight();
    expect(options()).toHaveLength(1);
    expect(highlighted()).toEqual([]);
  });

  it('never puts data-wmpal on a native node', () => {
    open('du cinéma');
    stop = startTagHighlight();
    expect(options().every((option) => !option.hasAttribute('data-wmpal'))).toBe(true);
  });

  it('re-evaluates the options swapped while typing', async () => {
    open('du cinéma');
    stop = startTagHighlight();
    const list = query(anchors.tagListbox)!;
    list.innerHTML = stateB.slice(stateB.indexOf('<li'), stateB.lastIndexOf('</li>') + 5);
    await frame();
    expect(highlighted()).toEqual([]);

    list.innerHTML = stateA.slice(stateA.indexOf('<li'), stateA.lastIndexOf('</li>') + 5);
    await frame();
    expect(highlighted()).toEqual(['Cinéma']);
  });

  it('removes its classes on stop', () => {
    open('du cinéma');
    stop = startTagHighlight();
    expect(highlighted()).toEqual(['Cinéma']);
    stop();
    expect(highlighted()).toEqual([]);
    scan();
    expect(highlighted()).toEqual([]);
  });
});

describe('through the runner', () => {
  const settled = (count: number) => vi.waitFor(() => expect(highlighted()).toHaveLength(count));

  it('follows the feature toggle', async () => {
    open('du cinéma');
    stop = startRunner(features, starters);
    await settled(1);

    await setFeature('tag-highlight', false);
    await settled(0);

    await setFeature('tag-highlight', true);
    await settled(1);
    expect(highlighted()).toEqual(['Cinéma']);
  });
});
