import { beforeEach, describe, expect, it } from 'vitest';
import { mark, query, queryAll } from './query';

beforeEach(() => {
  document.body.innerHTML = '';
});

describe('query', () => {
  it('returns the first match', () => {
    document.body.innerHTML = '<p id="a"></p><p id="b"></p>';

    expect(query('p')?.id).toBe('a');
  });

  it('returns null without match', () => {
    expect(query('p')).toBeNull();
  });

  it('skips a marked match and returns the next one', () => {
    document.body.innerHTML = '<p id="a" data-wmpal="x"></p><p id="b"></p>';

    expect(query('p')?.id).toBe('b');
  });

  it('skips a match nested in a marked element', () => {
    document.body.innerHTML = '<div data-wmpal="x"><p id="a"></p></div><p id="b"></p>';

    expect(query('p')?.id).toBe('b');
  });

  it('searches inside the given root', () => {
    document.body.innerHTML = '<p id="a"></p><section><p id="b"></p></section>';

    expect(query('p', document.querySelector('section')!)?.id).toBe('b');
  });

  it('supports :scope selectors', () => {
    document.body.innerHTML = '<section><p id="a"></p><div><p id="b"></p></div></section>';

    expect(query(':scope > div > p', document.querySelector('section')!)?.id).toBe('b');
  });
});

describe('queryAll', () => {
  it('returns every unmarked match', () => {
    document.body.innerHTML =
      '<p id="a"></p><p id="b" data-wmpal="x"></p><div data-wmpal="y"><p id="c"></p></div><p id="d"></p>';

    expect(queryAll('p').map((el) => el.id)).toEqual(['a', 'd']);
  });

  it('returns an empty array without match', () => {
    expect(queryAll('p')).toEqual([]);
  });
});

describe('mark', () => {
  it('sets data-wmpal to the feature id', () => {
    const node = document.createElement('div');

    mark(node, 'my-feature-2');

    expect(node.getAttribute('data-wmpal')).toBe('my-feature-2');
  });

  it.each(['', 'Upper', 'a b', 'a_b', 'é'])('throws on the invalid id "%s"', (id) => {
    const node = document.createElement('div');

    expect(() => mark(node, id)).toThrow();
    expect(node.hasAttribute('data-wmpal')).toBe(false);
  });
});
