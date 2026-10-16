import { fakeBrowser } from '@webext-core/fake-browser';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import collection from '../fixtures/collection.html?raw';
import modale from '../fixtures/modale.html?raw';
import { ext } from '../../src/shared/ext';
import { json, stubFetch } from '../helpers/fetch';

type Memory = typeof import('../../src/content/tag-memory');
type Proposal = typeof import('../../src/content/tag-proposal');
let memory: Memory;
let proposal: Proposal;
let stop = (): void => undefined;

const TITLE = 'Sonja Haraldsen';
const OTHER = 'Mercredi (série télévisée)';

beforeEach(async () => {
  fakeBrowser.reset();
  vi.resetModules();
  vi.spyOn(ext.runtime, 'getManifest').mockReturnValue({
    version: '1.2.3',
  } as chrome.runtime.Manifest);
  history.pushState({}, '', '/collection');
  memory = await import('../../src/content/tag-memory');
  proposal = await import('../../src/content/tag-proposal');
});

afterEach(() => {
  stop();
  document.body.innerHTML = '';
  history.pushState({}, '', '/');
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

const frame = async (): Promise<void> => {
  await Promise.resolve();
  await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
};

const sparql = (...titles: string[]) =>
  json({
    results: {
      bindings: titles.map((title, i) => ({
        title: { value: title },
        item: { value: `http://www.wikidata.org/entity/Q${i + 1}` },
        cat: { value: 'http://www.wikidata.org/entity/Q5' },
        catLabel: { value: 'être humain' },
        prop: { value: 'P31' },
      })),
    },
  });

const hang = (_url: URL, init: RequestInit) =>
  new Promise<Response>((_resolve, reject) => {
    init.signal!.addEventListener('abort', () => reject(init.signal!.reason as Error));
  });

const start = (): void => {
  stop = proposal.startTagProposal();
};
const all = () => memory.readTagMemory();
const chips = (card: Element) => card.querySelector('div.flex-wrap[class~="pb-0.5"]');

describe('tag-proposal on the collection page', () => {
  it('learns every card in one write and one request', async () => {
    const { calls } = stubFetch(sparql(TITLE));
    const set = vi.spyOn(ext.storage.local, 'set');
    document.body.innerHTML = collection;
    start();

    await vi.waitFor(async () => expect((await all())[TITLE]?.cats).toEqual(['Q5']));
    expect((await all())[TITLE]?.tags).toEqual(['Norvège']);
    expect(calls).toHaveLength(1);
    // snapshot, cat completion, wikidata cache
    expect(set.mock.calls.filter(([items]) => 'tagMemory' in items)).toHaveLength(2);
  });

  it('deletes the entry of an untagged card and does not request it', async () => {
    const { calls } = stubFetch(sparql(TITLE));
    await memory.snapshot(OTHER, ['Vieux'], ['Q9']);
    document.body.innerHTML = collection;
    start();

    await vi.waitFor(async () => expect((await all())[OTHER]).toBeUndefined());
    await vi.waitFor(async () => expect((await all())[TITLE]?.cats).toEqual(['Q5']));
    const asked = calls.map((call) => call.url.searchParams.get('query') ?? '').join('');
    expect(asked).not.toContain(OTHER);
  });

  it('sends no request when no card has a tag', async () => {
    const { calls } = stubFetch(sparql());
    document.body.innerHTML = collection;
    for (const card of document.querySelectorAll('div.flex-wrap[class~="pb-0.5"]')) card.remove();
    start();

    await frame();
    await frame();
    expect(calls).toHaveLength(0);
    expect(await all()).toEqual({});
  });

  it('skips a card whose tag list is cut', async () => {
    stubFetch(sparql());
    await memory.snapshot(TITLE, ['Ancien']);
    document.body.innerHTML = collection;
    chips(document.body)!.insertAdjacentHTML('beforeend', '<span class="rounded-full">+2</span>');
    start();

    await frame();
    await frame();
    expect((await all())[TITLE]?.tags).toEqual(['Ancien']);
  });

  it('does nothing on another page', async () => {
    const { calls } = stubFetch(sparql(TITLE));
    history.pushState({}, '', '/echanger');
    document.body.innerHTML = collection;
    start();

    await frame();
    await frame();
    expect(calls).toHaveLength(0);
    expect(await all()).toEqual({});
  });

  it('learns a new batch when the page changes', async () => {
    const { calls } = stubFetch((url) => {
      const query = url.searchParams.get('query') ?? '';
      return sparql(...['Sonja Haraldsen', 'Alien'].filter((name) => query.includes(`"${name}"`)));
    });
    document.body.innerHTML = collection;
    start();
    await vi.waitFor(async () => expect((await all())[TITLE]?.cats).toEqual(['Q5']));

    document.body.innerHTML = collection
      .replaceAll('Sonja Haraldsen', 'Alien')
      .replaceAll('Norvège', 'SF');
    await vi.waitFor(async () => expect((await all()).Alien?.cats).toEqual(['Q5']));
    expect((await all()).Alien?.tags).toEqual(['SF']);
    expect(calls).toHaveLength(2);
  });

  it('writes nothing after stop, even when the request ends later', async () => {
    const { calls } = stubFetch(hang);
    document.body.innerHTML = collection;
    start();
    await vi.waitFor(() => expect(calls).toHaveLength(1));
    await vi.waitFor(async () => expect((await all())[TITLE]?.tags).toEqual(['Norvège']));

    stop();
    await frame();
    await frame();
    expect((await all())[TITLE]?.cats).toBeNull();
  });

  it('writes nothing when stopped before the batch is flushed', async () => {
    const { calls } = stubFetch(sparql(TITLE));
    document.body.innerHTML = collection;
    start();
    stop();

    await frame();
    expect(calls).toHaveLength(0);
    expect(await all()).toEqual({});
  });

  it('leaves the cards of the detail modal to the modal path', async () => {
    const { calls } = stubFetch(sparql(TITLE));
    document.body.innerHTML = modale.replace('>Sonja Haraldsen</h3>', '>Autre titre</h3>');
    start();

    await vi.waitFor(async () => expect((await all())[TITLE]?.cats).toEqual(['Q5']));
    expect((await all())['Autre titre']).toBeUndefined();
    expect(calls).toHaveLength(1);
  });
});
