import { fakeBrowser } from '@webext-core/fake-browser';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import listbox from '../fixtures/listbox.html?raw';
import modale from '../fixtures/modale.html?raw';
import { ext } from '../../src/shared/ext';
import { json, stubFetch } from '../helpers/fetch';

type Memory = typeof import('../../src/content/tag-memory');
type Runner = typeof import('../../src/content/runner');
type Proposal = typeof import('../../src/content/tag-proposal');
type Registry = typeof import('../../src/shared/features');
type Starters = typeof import('../../src/content/features');
type Settings = typeof import('../../src/shared/settings');
let memory: Memory;
let proposal: Proposal;
let startRunner: Runner['startRunner'];
let features: Registry['features'];
let starters: Starters['starters'];
let setFeature: Settings['setFeature'];

const TITLE = 'Sonja Haraldsen';
const [, stateA = ''] = listbox.split(/<!-- Etat [AB][^>]*-->/);

// module state of wikidata.ts (queue, in-flight) must not leak between tests
beforeEach(async () => {
  fakeBrowser.reset();
  vi.resetModules();
  vi.spyOn(ext.runtime, 'getManifest').mockReturnValue({
    version: '1.2.3',
  } as chrome.runtime.Manifest);
  vi.spyOn(ext.i18n, 'getMessage').mockImplementation((key, subs) =>
    [key, ...[subs ?? []].flat()].join('|'),
  );
  memory = await import('../../src/content/tag-memory');
  proposal = await import('../../src/content/tag-proposal');
  ({ startRunner } = await import('../../src/content/runner'));
  ({ features } = await import('../../src/shared/features'));
  ({ starters } = await import('../../src/content/features'));
  ({ setFeature } = await import('../../src/shared/settings'));
});

let stop = (): void => undefined;

afterEach(() => {
  stop();
  document.body.innerHTML = '';
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

const frame = async (): Promise<void> => {
  await Promise.resolve();
  await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
};

const human = () =>
  json({
    results: {
      bindings: [
        {
          item: { value: 'http://www.wikidata.org/entity/Q1' },
          cat: { value: 'http://www.wikidata.org/entity/Q5' },
          catLabel: { value: 'être humain' },
          prop: { value: 'P31' },
        },
      ],
    },
  });

const hang = (_url: URL, init: RequestInit) =>
  new Promise<Response>((_resolve, reject) => {
    init.signal!.addEventListener('abort', () => reject(init.signal!.reason as Error));
  });

const modal = (): Element => document.querySelector('div.fixed.inset-0.z-50 > div.card-frame')!;
const chip = (): Element => modal().querySelector('span:has(> button[aria-label^="Retirer"])')!;
const mounted = (): void => {
  document.body.innerHTML = modale;
};
const start = (): void => {
  stop = startRunner(features, starters);
};
const entry = async () => (await memory.readTagMemory())[TITLE];
const seedEntry = (tags: string[], cats: string[] | null = null) =>
  memory.snapshot(TITLE, tags, cats ?? undefined);

describe('tag-proposal learning', () => {
  it('snapshots a tagged card, requests once and completes its categories', async () => {
    const { calls } = stubFetch(human());
    mounted();
    start();

    await vi.waitFor(async () => expect((await entry())?.cats).toEqual(['Q5']));
    expect((await entry())?.tags).toEqual(['Norvège']);
    expect(calls).toHaveLength(1);
  });

  it('sends no request for a card without tag and deletes its entry', async () => {
    const { calls } = stubFetch(human());
    await seedEntry(['Norvège'], ['Q5']);
    mounted();
    chip().remove();
    start();

    await vi.waitFor(async () => expect(await entry()).toBeUndefined());
    await frame();
    expect(calls).toHaveLength(0);
  });

  it('re-snapshots when a chip is added', async () => {
    stubFetch(human());
    mounted();
    start();
    await vi.waitFor(async () => expect((await entry())?.cats).toEqual(['Q5']));

    chip().insertAdjacentHTML(
      'afterend',
      `<span>Reine<button aria-label="Retirer l'étiquette Reine">×</button></span>`,
    );
    await vi.waitFor(async () => expect((await entry())?.tags).toEqual(['Norvège', 'Reine']));
    expect((await entry())?.cats).toEqual(['Q5']);
  });

  it('re-snapshots when the menu opens after a chip removal', async () => {
    stubFetch(human());
    mounted();
    start();
    await vi.waitFor(async () => expect((await entry())?.tags).toEqual(['Norvège']));

    chip().remove();
    modal().insertAdjacentHTML('beforeend', stateA);
    await vi.waitFor(async () => expect(await entry()).toBeUndefined());
  });

  it('requests the categories when the menu opens on a card without tag', async () => {
    const { calls } = stubFetch(human());
    mounted();
    chip().remove();
    start();
    await frame();
    expect(calls).toHaveLength(0);

    modal().insertAdjacentHTML('beforeend', stateA);
    await vi.waitFor(() => expect(calls).toHaveLength(1));
    expect(calls[0]?.url.searchParams.get('query')).toContain(`"${TITLE}"@fr`);
  });

  it('writes nothing after stop, even when the request ends later', async () => {
    const { calls } = stubFetch(hang);
    mounted();
    start();
    await vi.waitFor(() => expect(calls).toHaveLength(1));
    await vi.waitFor(async () => expect((await entry())?.tags).toEqual(['Norvège']));

    stop();
    await frame();
    await frame();
    expect((await entry())?.cats).toBeNull();
  });

  it('keeps the memory when the feature is turned off', async () => {
    stubFetch(human());
    mounted();
    start();
    await vi.waitFor(async () => expect((await entry())?.cats).toEqual(['Q5']));

    await setFeature('tag-proposal', false);
    await frame();
    expect(await entry()).toMatchObject({ tags: ['Norvège'], cats: ['Q5'] });
  });

  it('leaves the categories null when the request fails', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    stubFetch(new Error('network down'));
    mounted();
    start();

    await vi.waitFor(async () => expect((await entry())?.tags).toEqual(['Norvège']));
    await frame();
    expect((await entry())?.cats).toBeNull();
    expect(error).not.toHaveBeenCalled();
  });
});

const cinema = () =>
  json({
    results: {
      bindings: [
        {
          item: { value: 'http://www.wikidata.org/entity/Q2' },
          cat: { value: 'http://www.wikidata.org/entity/Q6' },
          catLabel: { value: 'cinéma' },
          prop: { value: 'P106' },
        },
      ],
    },
  });

const missing = () => json({ results: { bindings: [] } });

const lines = (): Element[] => [...document.querySelectorAll('li.wmpal-tag-hint')];
const line = (): Element | undefined => lines()[0];
const listboxEl = (): Element => document.querySelector('ul[role="listbox"]')!;
const proposedLabels = (): string[] =>
  [...document.querySelectorAll('li.wmpal-proposed')].map((li) => li.textContent.trim());
const reorderedLists = (): Element[] => [...document.querySelectorAll('ul.wmpal-reorder')];
const optionLabels = (): string[] =>
  [...document.querySelectorAll('li[role="option"]')].map((li) => li.textContent.trim());
const open = (): void => {
  mounted();
  chip().remove();
  modal().insertAdjacentHTML('beforeend', stateA);
};
const state = () => ({
  lines: lines().length,
  proposed: proposedLabels(),
  reordered: reorderedLists().length,
});
const chipHtml = (() => {
  mounted();
  const html = chip().outerHTML;
  document.body.innerHTML = '';
  return html;
})();
const NONE = { lines: 0, proposed: [], reordered: 0 };

describe('tag-proposal rendering', () => {
  it('injects nothing while the request is pending', () => {
    stubFetch(hang);
    open();
    stop = proposal.startTagProposal();

    expect(lines()).toHaveLength(0);
    expect(listboxEl().firstElementChild?.getAttribute('role')).toBe('option');
  });

  it('marks the native option and the list for a tag proposal, with no line', async () => {
    stubFetch(cinema());
    open();
    const before = optionLabels();
    stop = proposal.startTagProposal();

    await vi.waitFor(() => expect(proposedLabels()).toEqual(['Cinéma']));
    expect(reorderedLists()).toEqual([listboxEl()]);
    expect(lines()).toHaveLength(0);
    expect(optionLabels()).toEqual(before);
  });

  it('marks the options swapped in while typing', async () => {
    stubFetch(cinema());
    open();
    stop = proposal.startTagProposal();
    await vi.waitFor(() => expect(proposedLabels()).toEqual(['Cinéma']));

    const options = [...listboxEl().children].filter((li) => li.getAttribute('role') === 'option');
    for (const option of options) option.remove();
    listboxEl().insertAdjacentHTML('beforeend', options.map((o) => o.outerHTML).join(''));
    await frame();

    expect(proposedLabels()).toEqual(['Cinéma']);
    expect(reorderedLists()).toHaveLength(1);
    expect(lines()).toHaveLength(0);
  });

  it('shows the Wikidata line, and no class, when no option matches', async () => {
    stubFetch(human());
    open();
    stop = proposal.startTagProposal();

    await vi.waitFor(() => expect(line()?.textContent).toBe('tagProposalHint|être humain'));
    expect(lines()).toHaveLength(1);
    expect(line()?.getAttribute('data-wmpal')).toBe('tag-proposal');
    expect(line()?.getAttribute('role')).toBe('presentation');
    expect(listboxEl().firstElementChild).toBe(line());
    expect(proposedLabels()).toEqual([]);
    expect(reorderedLists()).toHaveLength(0);
  });

  it('shows neither the line nor the class on a card with a tag, and still learns it', async () => {
    stubFetch(cinema());
    mounted();
    modal().insertAdjacentHTML('beforeend', stateA);
    stop = proposal.startTagProposal();

    await vi.waitFor(async () => expect((await entry())?.cats).toEqual(['Q6']));
    await frame();
    expect((await entry())?.tags).toEqual(['Norvège']);
    expect(state()).toEqual(NONE);
  });

  it('proposes nothing when a chip arrives after the menu but before the categories', async () => {
    let release: () => void = () => undefined;
    const gate = new Promise<void>((resolve) => (release = resolve));
    stubFetch(async () => {
      await gate;
      return cinema();
    });
    open();
    stop = proposal.startTagProposal();
    await frame();

    modal().insertAdjacentHTML('beforeend', chipHtml);
    release();
    await vi.waitFor(async () => expect((await entry())?.cats).toEqual(['Q6']));
    await frame();
    expect(state()).toEqual(NONE);
  });

  it('removes the line, the class and the reorder class when a chip is added', async () => {
    stubFetch(cinema());
    open();
    stop = proposal.startTagProposal();
    await vi.waitFor(() => expect(proposedLabels()).toEqual(['Cinéma']));

    modal().insertAdjacentHTML('beforeend', chipHtml);
    await vi.waitFor(() => expect(state()).toEqual(NONE));
  });

  it('removes the Wikidata line when a chip is added', async () => {
    stubFetch(human());
    open();
    stop = proposal.startTagProposal();
    await vi.waitFor(() => expect(lines()).toHaveLength(1));

    modal().insertAdjacentHTML('beforeend', chipHtml);
    await vi.waitFor(() => expect(state()).toEqual(NONE));
  });

  it('shows nothing on failure', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    stubFetch(new Error('network down'));
    open();
    stop = proposal.startTagProposal();

    await frame();
    await frame();
    expect(state()).toEqual(NONE);
    expect(error).not.toHaveBeenCalled();
    expect(await fakeBrowser.storage.local.get('wikidataCache')).toEqual({});
  });

  it('shows nothing for a card without Wikidata item', async () => {
    stubFetch(missing());
    open();
    stop = proposal.startTagProposal();

    await frame();
    await frame();
    expect(state()).toEqual(NONE);
  });

  it('writes nothing in the DOM when stopped during the request', async () => {
    const { calls } = stubFetch(hang);
    open();
    const stopFeature = proposal.startTagProposal();
    await vi.waitFor(() => expect(calls).toHaveLength(1));

    stopFeature();
    await frame();
    await frame();
    expect(state()).toEqual(NONE);
  });

  it('writes nothing in the DOM when stopped after the answer', async () => {
    stubFetch(cinema());
    open();
    const stopFeature = proposal.startTagProposal();
    stopFeature();
    await frame();
    await frame();

    expect(state()).toEqual(NONE);
  });

  it('removes the classes on stop', async () => {
    stubFetch(cinema());
    open();
    const stopFeature = proposal.startTagProposal();
    await vi.waitFor(() => expect(proposedLabels()).toEqual(['Cinéma']));

    stopFeature();
    expect(state()).toEqual(NONE);
  });

  it('removes the Wikidata line on stop', async () => {
    stubFetch(human());
    open();
    const stopFeature = proposal.startTagProposal();
    await vi.waitFor(() => expect(lines()).toHaveLength(1));

    stopFeature();
    expect(lines()).toHaveLength(0);
  });

  it('does not let a gesture on the Wikidata line reach the native menu', async () => {
    stubFetch(human());
    open();
    stop = proposal.startTagProposal();
    await vi.waitFor(() => expect(lines()).toHaveLength(1));

    const seen = vi.fn();
    const native = listboxEl().parentElement!;
    for (const type of ['click', 'auxclick', 'pointerdown', 'mousedown', 'keydown']) {
      native.addEventListener(type, seen);
      line()!.dispatchEvent(new Event(type, { bubbles: true, cancelable: true }));
    }
    expect(seen).not.toHaveBeenCalled();
    const mousedown = new Event('mousedown', { bubbles: true, cancelable: true });
    line()!.dispatchEvent(mousedown);
    expect(mousedown.defaultPrevented).toBe(true);
  });

  it('keeps its own state per modal', async () => {
    stubFetch(cinema());
    open();
    document.body.insertAdjacentHTML('beforeend', modale);
    const second = document.querySelectorAll('div.fixed.inset-0.z-50 > div.card-frame')[1]!;
    second.querySelector('span:has(> button[aria-label^="Retirer"])')?.remove();
    stop = proposal.startTagProposal();
    await vi.waitFor(() => expect(proposedLabels()).toEqual(['Cinéma']));
    expect(reorderedLists()).toHaveLength(1);

    second.insertAdjacentHTML(
      'beforeend',
      stateA.replace('_r_4_', '_r_5_').replace('_r_4_', '_r_5_'),
    );
    await vi.waitFor(() => expect(proposedLabels()).toEqual(['Cinéma', 'Cinéma']));
    expect(reorderedLists()).toHaveLength(2);
    expect(second.querySelectorAll('li.wmpal-proposed')).toHaveLength(1);
    expect(modal().querySelectorAll('li.wmpal-proposed')).toHaveLength(1);
  });

  it('removes the classes when the feature is turned off', async () => {
    stubFetch(cinema());
    open();
    start();
    await vi.waitFor(() => expect(proposedLabels()).toEqual(['Cinéma']));

    await setFeature('tag-proposal', false);
    await vi.waitFor(() => expect(state()).toEqual(NONE));
  });
});

describe('createLearner snapshots', () => {
  it('skips a snapshot already written in the same tick', async () => {
    stubFetch(hang);
    mounted();
    const set = vi.spyOn(fakeBrowser.storage.local, 'set');
    const learner = proposal.createLearner();

    learner.learn(modal());
    learner.learn(modal());
    learner.learn(modal());
    await vi.waitFor(async () => expect((await entry())?.tags).toEqual(['Norvège']));
    expect(set).toHaveBeenCalledTimes(1);

    learner.learn(modal());
    await vi.waitFor(() => expect(set).toHaveBeenCalledTimes(2));
    learner.stop();
  });

  it('writes again when the tags differ in the same tick', async () => {
    stubFetch(human());
    mounted();
    const learner = proposal.createLearner();

    learner.learn(modal());
    chip().remove();
    learner.learn(modal());
    await vi.waitFor(async () => expect(await entry()).toBeUndefined());
    learner.stop();
  });
});
