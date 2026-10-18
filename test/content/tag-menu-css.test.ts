import { readFileSync } from 'node:fs';
import { afterEach, describe, expect, it } from 'vitest';
import masse from '../fixtures/modale-masse.html?raw';
import ouvert from '../fixtures/modale-menu-ouvert.html?raw';
import retirer from '../fixtures/modale-retirer.html?raw';

// Vitest empties ?raw on .css, the source is read from disk
const css = readFileSync('src/content/tag-menu.css', 'utf8');

const MARKER = '[data-wmpal-tag-menu';
// Only selector outside the marker: the native overlay, found by its marked child
const OVERLAY = "div:has(> [data-wmpal-tag-menu='detail'])";

const withoutComments = (source: string): string =>
  source
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/@keyframes[^{]*\{(?:[^{}]*\{[^{}]*\})*\s*\}/g, '');

const selectorLists = (source: string): string[] => {
  const lists: string[] = [];
  const text = withoutComments(source);
  const open = /([^{}]+)\{|\}/g;
  let depth = 0;
  let skipUntil = -1;
  for (const match of text.matchAll(open)) {
    if (skipUntil >= 0) {
      if (match[0] === '}') {
        depth -= 1;
        if (depth === skipUntil) skipUntil = -1;
      } else depth += 1;
      continue;
    }
    if (match[0] === '}') {
      depth -= 1;
      continue;
    }
    const prelude = (match[1] ?? '').trim();
    depth += 1;
    if (prelude.startsWith('@')) continue;
    lists.push(prelude);
    skipUntil = depth - 1;
  }
  return lists;
};

const splitTopLevel = (list: string): string[] => {
  const parts: string[] = [];
  let level = 0;
  let current = '';
  for (const char of list) {
    if (char === '(' || char === '[') level += 1;
    if (char === ')' || char === ']') level -= 1;
    if (char === ',' && level === 0) {
      parts.push(current.trim());
      current = '';
    } else current += char;
  }
  parts.push(current.trim());
  return parts;
};

const selectors = selectorLists(css).flatMap(splitTopLevel);

describe('tag-menu.css', () => {
  it('has rules', () => {
    expect(selectors.length).toBeGreaterThan(10);
  });

  it('puts every rule under the marker', () => {
    expect(
      selectors.filter((selector) => !selector.startsWith(MARKER) && selector !== OVERLAY),
    ).toEqual([]);
  });

  it('keeps the modal from becoming the containing block of the fixed panel (Q19)', () => {
    const rule = /\[data-wmpal-tag-menu='detail'\]\s*\{([^}]*)\}/.exec(
      withoutComments(css).replace(/@media[^{]*\{[\s\S]*?\n\}\n/g, ''),
    );
    expect(rule?.[1]).toMatch(/transform:\s*none\s*!important/);
    expect(rule?.[1]).toMatch(/animation-name:\s*wmpal-fade\s*!important/);
    expect(rule?.[1]).toMatch(/(?<!-webkit-)backdrop-filter:\s*none\s*!important/);
    expect(rule?.[1]).toMatch(/-webkit-backdrop-filter:\s*none\s*!important/);
  });

  it('declares no transform in the fade keyframes, only opacity', () => {
    const frames = /@keyframes wmpal-fade\s*\{([\s\S]*?\n\})/.exec(css);
    expect(frames?.[1]).toContain('opacity');
    expect(frames?.[1]).not.toContain('transform');
  });

  it('switches between panel and drawer at the same width as tag-focus (64rem)', () => {
    expect(css).toContain('@media (min-width: 64rem)');
    expect(css).toContain('@media (max-width: 63.99rem)');
    expect(readFileSync('src/content/tag-focus.ts', 'utf8')).toContain("'(min-width: 64rem)'");
  });

  it('cancels the order of the proposed option under the marker (Q14)', () => {
    const rule = /(\[data-wmpal-tag-menu[^{]*\.wmpal-proposed)\s*\{([^}]*)\}/.exec(
      withoutComments(css),
    );
    expect(rule?.[1]).toMatch(/^\[data-wmpal-tag-menu/);
    expect(rule?.[2]).toMatch(/order:\s*0\b/);
  });

  it('targets no class but wmpal-*', () => {
    const classes = selectors.flatMap((selector) =>
      [...selector.replace(/\[[^\]]*\]/g, '').matchAll(/\.(-?[_a-zA-Z][\w-]*)/g)].map((m) => m[1]),
    );
    expect(classes.filter((name) => !name?.startsWith('wmpal-'))).toEqual([]);
  });

  describe('applied on the open detail modal', () => {
    afterEach(() => {
      document.head.innerHTML = '';
      document.body.innerHTML = '';
    });

    const mount = (marked: boolean): HTMLElement => {
      const style = document.createElement('style');
      // Stand-in for the native utilities, loaded first like the site sheet
      style.textContent = `.absolute{position:absolute}.max-h-48{max-height:192px}.overflow-auto{overflow:auto}${css}`;
      document.head.append(style);
      document.body.innerHTML = ouvert;
      const frame = document.querySelector<HTMLElement>('.card-frame');
      if (marked) frame?.setAttribute('data-wmpal-tag-menu', 'detail');
      const list = document.querySelector<HTMLElement>('[role="listbox"]');
      if (list === null) throw new Error('fixture without listbox');
      return list;
    };

    it('lets the list flow without inner scroll under the marker', () => {
      const style = getComputedStyle(mount(true));
      expect([style.position, style.maxHeight, style.overflow]).toEqual([
        'static',
        'none',
        'visible',
      ]);
    });

    it('leaves the native list alone without the marker', () => {
      const style = getComputedStyle(mount(false));
      expect([style.position, style.maxHeight, style.overflow]).toEqual([
        'absolute',
        '192px',
        'auto',
      ]);
    });
  });
  describe('applied on the bulk modal', () => {
    afterEach(() => {
      document.head.innerHTML = '';
      document.body.innerHTML = '';
    });

    const mount = (html: string, marked: boolean): HTMLElement => {
      const style = document.createElement('style');
      // Same stand-ins, jsdom does not expand shorthands
      style.textContent = `.max-h-64{max-height:16rem}.overflow-y-auto{overflow:auto}.border{border-width:1px}.inline-flex{display:inline-flex}${css}`;
      document.head.append(style);
      document.body.innerHTML = html;
      if (marked)
        document.querySelector('.card-frame')?.setAttribute('data-wmpal-tag-menu', 'bulk');
      const list = document.querySelector<HTMLElement>('input + div');
      if (list === null) throw new Error('fixture without list');
      return list;
    };

    it('drops the inner scroll of the list under the marker', () => {
      const style = getComputedStyle(mount(masse, true));
      expect([style.maxHeight, style.overflow]).toEqual(['none', 'visible']);
    });

    it('keeps the native scroll without the marker', () => {
      const style = getComputedStyle(mount(masse, false));
      expect([style.maxHeight, style.overflow]).toEqual(['256px', 'auto']);
    });

    it('neutralizes the native chip background despite its inline style', () => {
      const chip = mount(masse, true).querySelector<HTMLElement>('button > span');
      const style = getComputedStyle(chip!);
      expect([style.backgroundColor, style.borderTopWidth]).toEqual(['rgba(0, 0, 0, 0)', '0px']);
    });

    it('keeps the native chip colors without the marker', () => {
      const chip = mount(masse, false).querySelector<HTMLElement>('button > span');
      expect(getComputedStyle(chip!).backgroundColor).toBe('rgba(244, 114, 182, 0.22)');
    });

    it('keeps the remove count at the right of the row', () => {
      const count = mount(retirer, true).querySelectorAll<HTMLElement>('button > span')[1];
      expect(getComputedStyle(count!).marginLeft).toBe('auto');
    });
  });

  it('widens the ✕ touch area on mobile without growing the chip', () => {
    const mobile = /@media \(max-width: 63\.99rem\)\s*\{([\s\S]*?)\n\}/.exec(css)?.[1] ?? '';
    const button = /button\[aria-label\]\s*\{([^}]*)\}/.exec(mobile)?.[1] ?? '';
    expect(button).not.toMatch(/min-(height|width)/);
    expect(mobile).toMatch(/button\[aria-label\]::after\s*\{[^}]*inset:\s*-0\.75rem/);
  });
});
