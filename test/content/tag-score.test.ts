import { describe, expect, it } from 'vitest';
import { propose, type TagEntry } from '../../src/content/tag-memory';
import type { Category } from '../../src/content/wikidata';

const cat = (id: string, label = id, prop: Category['prop'] = 'P31'): Category => ({
  id,
  label,
  prop,
});
const card = (cats: string[] | null, tags: string[], at = 1): TagEntry => ({ cats, tags, at });

const base = {
  title: 'Open',
  cats: [cat('Q1')],
  candidates: ['SF', 'Drame'],
  posed: [] as string[],
  memory: {} as Record<string, TagEntry>,
};

describe('propose, score', () => {
  it('takes a single card when every similar card agrees', () => {
    const one = { ...base, memory: { A: card(['Q1'], ['SF']) } };
    expect(propose(one)).toEqual({ kind: 'tag', name: 'SF' });
    const split = { ...base, memory: { A: card(['Q1'], ['SF']), B: card(['Q1'], ['Drame']) } };
    expect(propose(split)).toEqual({ kind: 'hint', label: 'Q1' });
  });

  it('does not count an untagged similar card', () => {
    const memory = { A: card(['Q1'], ['SF']), B: card(['Q1'], []) };
    expect(propose({ ...base, memory })).toEqual({ kind: 'tag', name: 'SF' });
  });

  it('ignores cards without a shared category', () => {
    const memory = { A: card(['Q1'], ['SF']), B: card(['Q1'], ['Drame']), C: card(['Q9'], ['SF']) };
    expect(propose({ ...base, memory })).toEqual({ kind: 'hint', label: 'Q1' });
  });

  it('skips cards with unknown cats', () => {
    const memory = { A: card(['Q1'], ['SF']), B: card(['Q1'], ['Drame']), C: card(null, ['SF']) };
    expect(propose({ ...base, memory })).toEqual({ kind: 'hint', label: 'Q1' });
  });

  it('excludes the open card from its own count', () => {
    const memory = {
      A: card(['Q1'], ['SF']),
      B: card(['Q1'], ['Drame']),
      Open: card(['Q1'], ['SF']),
    };
    expect(propose({ ...base, memory })).toEqual({ kind: 'hint', label: 'Q1' });
  });

  it('ignores tags that are not options', () => {
    const memory = { A: card(['Q1'], ['Gone']), B: card(['Q1'], ['Gone']) };
    expect(propose({ ...base, memory })).toEqual({ kind: 'hint', label: 'Q1' });
  });

  it('proposes nothing for a card that already has a tag, however strong the memory', () => {
    const memory = { A: card(['Q1'], ['SF']), B: card(['Q1'], ['SF']), C: card(['Q1'], ['SF']) };
    expect(propose({ ...base, memory })).toEqual({ kind: 'tag', name: 'SF' });
    expect(propose({ ...base, memory, posed: ['Drame'] })).toBeNull();
  });

  it('ignores P31 when the open card has an occupation', () => {
    const cats = [cat('Q5', 'être humain'), cat('Q9', 'espion', 'P106')];
    const memory = { A: card(['Q5', 'Q33999'], ['SF']), B: card(['Q5', 'Q33999'], ['SF']) };
    expect(propose({ ...base, cats, memory })).toEqual({ kind: 'hint', label: 'espion' });
    const spies = { ...memory, C: card(['Q5', 'Q9'], ['Drame']), D: card(['Q5', 'Q9'], ['Drame']) };
    expect(propose({ ...base, cats, memory: spies })).toEqual({ kind: 'tag', name: 'Drame' });
  });

  it('proposes nothing when similar cards are split between tags', () => {
    const memory = {
      A: card(['Q1'], ['SF']),
      B: card(['Q1'], ['SF']),
      C: card(['Q1'], ['Drame']),
      D: card(['Q1'], ['Drame']),
    };
    expect(propose({ ...base, memory })).toEqual({ kind: 'hint', label: 'Q1' });
    const clear = { ...memory, E: card(['Q1'], ['SF']), F: card(['Q1'], ['SF']) };
    expect(propose({ ...base, memory: clear })).toEqual({ kind: 'tag', name: 'SF' });
  });

  it('breaks a tie by the newest contributing card', () => {
    const memory = {
      A: card(['Q1'], ['SF', 'Drame'], 1),
      B: card(['Q1'], ['SF', 'Drame'], 2),
      C: card(['Q1'], ['Drame'], 5),
      D: card(['Q1'], ['SF'], 6),
    };
    expect(propose({ ...base, memory })).toEqual({ kind: 'tag', name: 'SF' });
  });

  it('breaks a remaining tie with localeCompare', () => {
    const memory = {
      A: card(['Q1'], ['SF', 'Écologie'], 5),
      B: card(['Q1'], ['SF', 'Écologie'], 5),
    };
    const candidates = ['SF', 'Écologie'];
    expect(propose({ ...base, candidates, memory })).toEqual({ kind: 'tag', name: 'Écologie' });
  });
});

describe('propose, exact name', () => {
  it('matches despite case and accents', () => {
    const input = { ...base, cats: [cat('Q2', 'Film')], candidates: ['film'] };
    expect(propose(input)).toEqual({ kind: 'tag', name: 'film' });
    const accents = { ...base, cats: [cat('Q2', 'Écrivain')], candidates: ['ecrivain'] };
    expect(propose(accents)).toEqual({ kind: 'tag', name: 'ecrivain' });
  });

  it('matches singular with plural', () => {
    const input = { ...base, cats: [cat('Q2', 'acteur')], candidates: ['Acteurs'] };
    expect(propose(input)).toEqual({ kind: 'tag', name: 'Acteurs' });
  });

  it('proposes nothing, not even a hint, for a card that already has a tag', () => {
    const input = { ...base, cats: [cat('Q2', 'Film')], candidates: ['Film'], posed: ['Drame'] };
    expect(propose({ ...input, posed: [] })).toEqual({ kind: 'tag', name: 'Film' });
    expect(propose(input)).toBeNull();
  });

  it('matches an occupation by its first form', () => {
    const input = {
      ...base,
      cats: [cat('Q3', 'acteur ou actrice', 'P106')],
      candidates: ['Acteurs'],
    };
    expect(propose(input)).toEqual({ kind: 'tag', name: 'Acteurs' });
  });

  it('wins over a whole word', () => {
    const input = {
      ...base,
      cats: [cat('Q2', 'arts martiaux')],
      candidates: ['Art', 'Arts martiaux'],
    };
    expect(propose(input)).toEqual({ kind: 'tag', name: 'Arts martiaux' });
  });

  it('prefers a P106 match over an earlier P31 match', () => {
    const input = {
      ...base,
      cats: [cat('Q2', 'Film'), cat('Q3', 'Acteur', 'P106')],
      candidates: ['Film', 'Acteur'],
    };
    expect(propose(input)).toEqual({ kind: 'tag', name: 'Acteur' });
  });
});

describe('propose, whole word', () => {
  it('finds a tag inside a longer label', () => {
    const input = { ...base, cats: [cat('Q2', 'drapeau national')], candidates: ['Drapeau'] };
    expect(propose(input)).toEqual({ kind: 'tag', name: 'Drapeau' });
  });

  it('finds a tag of several words', () => {
    const input = {
      ...base,
      cats: [cat('Q2', "pratiquant d'arts martiaux", 'P106')],
      candidates: ['Arts martiaux'],
    };
    expect(propose(input)).toEqual({ kind: 'tag', name: 'Arts martiaux' });
  });

  it('does not match part of a word', () => {
    const input = { ...base, cats: [cat('Q2', 'artiste peintre')], candidates: ['Art'] };
    expect(propose(input)).toEqual({ kind: 'hint', label: 'artiste peintre' });
  });

  it('comes after the learned cards', () => {
    const input = {
      ...base,
      cats: [cat('Q1', 'drapeau national')],
      candidates: ['Drapeau', 'Pays'],
      memory: { A: card(['Q1'], ['Pays']) },
    };
    expect(propose(input)).toEqual({ kind: 'tag', name: 'Pays' });
  });
});

describe('propose, hint', () => {
  it('puts P106 before P31', () => {
    const input = { ...base, cats: [cat('Q2', 'Être humain'), cat('Q3', 'Acteur', 'P106')] };
    expect(propose(input)).toEqual({ kind: 'hint', label: 'Acteur' });
  });

  it('uses P31 when it is the only one', () => {
    const input = { ...base, cats: [cat('Q2', 'Être humain')] };
    expect(propose(input)).toEqual({ kind: 'hint', label: 'Être humain' });
  });

  it('lists up to three occupations, first form only', () => {
    const cats = [
      cat('Q5', 'être humain'),
      cat('Q1', 'vendeur ou vendeuse', 'P106'),
      cat('Q2', 'espion ou espionne', 'P106'),
      cat('Q3', 'acteur ou actrice', 'P106'),
      cat('Q4', 'chanteur ou chanteuse', 'P106'),
    ];
    expect(propose({ ...base, cats })).toEqual({
      kind: 'hint',
      label: 'vendeur, espion, acteur',
    });
  });

  it('keeps the qualifier of an occupation and drops duplicates', () => {
    const cats = [
      cat('Q1', 'acteur ou actrice', 'P106'),
      cat('Q2', 'acteur ou actrice de cinéma', 'P106'),
      cat('Q3', 'acteur ou actrice', 'P106'),
    ];
    expect(propose({ ...base, cats })).toEqual({
      kind: 'hint',
      label: 'acteur, acteur de cinéma',
    });
  });

  it('is null without category', () => {
    expect(propose({ ...base, cats: [] })).toBeNull();
  });
});
