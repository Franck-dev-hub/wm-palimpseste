import { readFileSync } from 'node:fs';
import { afterEach, describe, expect, it } from 'vitest';
import ouvert from '../fixtures/modale-menu-ouvert.html?raw';

const css = readFileSync('src/content/tag-reveal.css', 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');

const MARKER = '[data-wmpal-tag-reveal]';
const OVERLAY = 'div:has(> [data-wmpal-tag-reveal])';
const BLOCK = "div:has(> div > [role='combobox'])";

const rules = [...css.matchAll(/([^{}@]+)\{([^{}]*)\}/g)].map((match) => ({
  selector: match[1]!.replace(/\s+/g, ' ').replace(/\( /g, '(').replace(/ \)/g, ')').trim(),
  body: match[2]!,
}));
const bodyOf = (selector: string): string =>
  rules.find((rule) => rule.selector === selector)?.body ?? '';

describe('tag-reveal.css', () => {
  afterEach(() => {
    document.head.innerHTML = '';
    document.body.innerHTML = '';
  });

  it('puts every rule under the marker or on its overlay', () => {
    expect(rules.length).toBeGreaterThan(2);
    expect(
      rules.filter(
        ({ selector }) => !/^\[data-wmpal-tag-reveal[\]=]/.test(selector) && selector !== OVERLAY,
      ),
    ).toEqual([]);
  });

  it('targets no class but wmpal-*', () => {
    const classes = rules.flatMap(({ selector }) =>
      [...selector.replace(/\[[^\]]*\]/g, '').matchAll(/\.(-?[_a-zA-Z][\w-]*)/g)].map((m) => m[1]),
    );
    expect(classes.filter((name) => !name?.startsWith('wmpal-'))).toEqual([]);
  });

  it('makes the overlay transparent, unblurred and click-through, with !important', () => {
    const body = bodyOf(OVERLAY);
    expect(body).toMatch(/background:\s*transparent\s*!important/);
    expect(body).toMatch(/(?<!-webkit-)backdrop-filter:\s*none\s*!important/);
    expect(body).toMatch(/-webkit-backdrop-filter:\s*none\s*!important/);
    expect(body).toMatch(/pointer-events:\s*none\s*!important/);
  });

  it('hides the window but keeps the tag block visible and clickable', () => {
    expect(bodyOf(MARKER)).toMatch(/visibility:\s*hidden\s*!important/);
    const block = bodyOf(`${MARKER} ${BLOCK}`);
    expect(block).toMatch(/visibility:\s*visible\s*!important/);
    expect(block).toMatch(/pointer-events:\s*auto\s*!important/);
  });

  it('places the panel from the card custom properties on desktop only', () => {
    const media = /@media \(min-width: 64rem\)\s*\{([\s\S]*)\}\s*$/.exec(css)?.[1] ?? '';
    expect(media).toContain('var(--wmpal-reveal-right');
    expect(media).toContain('var(--wmpal-reveal-top');
    expect(css.indexOf('--wmpal-reveal-right')).toBeGreaterThan(css.indexOf('@media'));
  });

  it('hides the window under the marker and not without it', () => {
    const style = document.createElement('style');
    style.textContent = css;
    document.head.append(style);
    document.body.innerHTML = ouvert;
    const frame = document.querySelector<HTMLElement>('.card-frame')!;
    expect(getComputedStyle(frame).visibility).not.toBe('hidden');
    frame.setAttribute('data-wmpal-tag-reveal', '');
    expect(getComputedStyle(frame).visibility).toBe('hidden');
  });

  it('hides every descendant outside the tag block without transition', () => {
    const hide = rules.find(
      ({ selector, body }) =>
        selector.startsWith(`${MARKER} *:not(`) && /visibility:\s*hidden\s*!important/.test(body),
    );
    expect(hide?.body).toMatch(/transition:\s*none\s*!important/);
    expect(bodyOf(MARKER)).toMatch(/transition:\s*none\s*!important/);
  });

  // A nested :has() voids the whole rule, the browser drops it silently
  it('never nests :has() inside :has()', () => {
    const nested = rules.filter(({ selector }) => {
      const stack: boolean[] = [];
      for (let i = 0; i < selector.length; i += 1) {
        if (selector[i] === '(') {
          const isHas = selector.slice(Math.max(0, i - 4), i) === ':has';
          if (isHas && stack.includes(true)) return true;
          stack.push(isHas);
        } else if (selector[i] === ')') stack.pop();
      }
      return false;
    });
    expect(nested).toEqual([]);
  });

  it('keeps the ghost layers hidden and the block subtree visible', () => {
    const style = document.createElement('style');
    style.textContent = css;
    document.head.append(style);
    document.body.innerHTML = ouvert;
    const frame = document.querySelector<HTMLElement>('.card-frame')!;
    frame.setAttribute('data-wmpal-tag-reveal', '');
    const block = frame.querySelector("[role='combobox']")!.parentElement!.parentElement!;
    const ghost = document.createElement('img');
    ghost.style.visibility = 'visible';
    frame.firstElementChild!.append(ghost);
    expect(getComputedStyle(ghost).visibility).toBe('hidden');
    expect(getComputedStyle(block).visibility).toBe('visible');
    expect(getComputedStyle(frame.querySelector('[role="combobox"]')!).visibility).toBe('visible');
  });

  it('lays the panel out in columns from the card top on desktop', () => {
    const media = /@media \(min-width: 64rem\)\s*\{([\s\S]*)\}\s*$/.exec(css)?.[1] ?? '';
    const panel = [...media.matchAll(/([^{}]+)\{([^{}]*)\}/g)].find(
      (m) => m[1]!.trim() === `${MARKER}[data-wmpal-tag-menu='detail'] ${BLOCK}`,
    )?.[2];
    expect(panel).toMatch(/top:\s*var\(--wmpal-reveal-top/);
    expect(panel).toMatch(/max-height:\s*calc\(100vh - var\(--wmpal-reveal-top/);
    expect(panel).toMatch(/transform:\s*none/);
    expect(panel).not.toMatch(/(^|[^-])height:\s*min\(/);
    const list = media.match(/ul\[role='listbox'\]\s*\{([^{}]*)\}/g)?.join('') ?? '';
    expect(list).toContain('repeat(var(--wmpal-reveal-rows');
    expect(list).not.toMatch(/display:\s*block/);
    expect(list).not.toMatch(/overflow-y:\s*auto/);
  });

  it('folds the mobile drawer to its title unless our window is unfolded', () => {
    const folded = rules.find(({ selector }) =>
      selector.includes(":not([data-wmpal-tag-reveal='open'])"),
    );
    expect(folded?.selector).toContain(`${BLOCK} > :not(p)`);
    expect(folded?.body).toMatch(/display:\s*none\s*!important/);
    expect(css.indexOf(":not([data-wmpal-tag-reveal='open'])")).toBeGreaterThan(
      css.indexOf('@media (max-width: 63.99rem)'),
    );
  });
});
