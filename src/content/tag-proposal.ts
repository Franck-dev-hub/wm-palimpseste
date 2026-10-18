import { ext } from '../shared/ext';
import {
  cardTags,
  inDetailModal,
  modalOf,
  modalTitle,
  tagNames,
  tagOptionLabel,
  tagOptionLabels,
  title as cardTitle,
} from './dom/anchors';
import { mark } from './dom/query';
import { watch } from './dom/watch';
import type { Start } from './features';
import {
  completeCats,
  completeCatsMany,
  propose,
  readTagMemory,
  snapshot,
  snapshotMany,
  type Snapshot,
} from './tag-memory';
import { type Categories, categoriesOf, categoriesOfMany } from './wikidata';
import './tags.css';

export const contentMessageKeys = ['tagProposalHint'] as const;

const FEATURE = 'tag-proposal';
const PROPOSED = 'wmpal-proposed';
const REORDER = 'wmpal-reorder';
const STOPPED = ['click', 'auxclick', 'pointerdown', 'mousedown', 'keydown'];

interface CardRead {
  title: string;
  tags: string[];
  // Resolves to null when not requested, failed or aborted; never rejects.
  cats: Promise<Categories | null>;
}

interface Learner {
  // `ask` requests the categories even for a card without tag (the menu needs them).
  learn: (modal: Element, ask?: boolean) => CardRead | null;
  // Cards of one collection page: one store write, one request batch, one completion.
  learnMany: (cards: Snapshot[]) => Promise<void>;
  stop: () => void;
}

export function createLearner(): Learner {
  const controller = new AbortController();
  const { signal } = controller;
  const written = new Map<string, string>();

  async function request(title: string): Promise<Categories | null> {
    try {
      const result = await categoriesOf(title, signal);
      if (result !== null && !signal.aborted) {
        await completeCats(
          title,
          result.cats.map((cat) => cat.id),
        );
      }
      return result;
    } catch (error) {
      if (!signal.aborted) console.error('[Palimpseste] tag-proposal', error);
      return null;
    }
  }

  function learn(modal: Element, ask = false): CardRead | null {
    if (signal.aborted) return null;
    const title = modalTitle(modal);
    if (title === null) return null;
    const tags = tagNames(modal);
    // Modal watches fire in one tick; each would rewrite the whole store.
    const signature = JSON.stringify(tags);
    if (written.get(title) !== signature) {
      if (written.size === 0) queueMicrotask(() => written.clear());
      written.set(title, signature);
      void snapshot(title, tags);
    }
    const cats = tags.length > 0 || ask ? request(title) : Promise.resolve(null);
    return { title, tags, cats };
  }

  async function learnMany(cards: Snapshot[]): Promise<void> {
    if (signal.aborted || cards.length === 0) return;
    try {
      await snapshotMany(cards);
      const titles = cards.filter((card) => card.tags.length > 0).map((card) => card.title);
      if (titles.length === 0) return;
      const found = await categoriesOfMany(titles, signal);
      if (signal.aborted || found.size === 0) return;
      await completeCatsMany(
        new Map([...found].map(([name, { cats }]) => [name, cats.map((cat) => cat.id)])),
      );
    } catch (error) {
      if (!signal.aborted) console.error('[Palimpseste] tag-proposal', error);
    }
  }

  return { learn, learnMany, stop: () => controller.abort() };
}

const swallow = (event: Event): void => {
  event.stopPropagation();
  // A mousedown would blur the combobox input and close the native menu.
  if (event.type === 'mousedown') event.preventDefault();
};

const createLine = (label: string): HTMLLIElement => {
  const line = document.createElement('li');
  line.className = 'wmpal-tag-hint';
  line.setAttribute('role', 'presentation');
  line.textContent = ext.i18n.getMessage('tagProposalHint', [label]);
  mark(line, FEATURE);
  // The line never acts (it is no option); the native menu must not see the gesture.
  for (const type of STOPPED) line.addEventListener(type, swallow);
  return line;
};

const isCollection = (): boolean => /^\/collection\/?$/.test(location.pathname);

export const startTagProposal: Start = () => {
  const learner = createLearner();
  const proposed = new Map<string, string>();
  const classed = new Set<Element>();
  const reordered = new Set<Element>();
  const lines = new Set<Element>();
  let stopped = false;

  const onModal = (modal: Element): void => void learner.learn(modal);
  // A tag posed while the menu is open removes the proposal (Q14)
  const withdraw = (modal: Element): void => {
    const title = modalTitle(modal);
    if (title !== null) proposed.delete(title);
    for (const line of lines) {
      if (modal.contains(line)) {
        line.remove();
        lines.delete(line);
      }
    }
    for (const option of classed) {
      if (modal.contains(option)) {
        option.classList.remove(PROPOSED);
        classed.delete(option);
      }
    }
    for (const listbox of reordered) {
      if (modal.contains(listbox)) {
        listbox.classList.remove(REORDER);
        reordered.delete(listbox);
      }
    }
  };

  const onChip = (el: Element): void => {
    const modal = modalOf(el);
    if (modal === null) return;
    withdraw(modal);
    void learner.learn(modal);
  };

  const classify = (option: Element, name: string): void => {
    if (tagOptionLabel(option) !== name) return;
    option.classList.add(PROPOSED);
    classed.add(option);
  };

  const onOption = (option: Element): void => {
    const modal = modalOf(option);
    const title = modal === null ? null : modalTitle(modal);
    const name = title === null ? undefined : proposed.get(title);
    if (name !== undefined) classify(option, name);
  };

  async function resolve(listbox: Element, modal: Element, candidates: string[]): Promise<void> {
    try {
      const read = learner.learn(modal, true);
      const found = read === null ? null : await read.cats;
      if (read === null || found === null) return;
      const memory = await readTagMemory();
      if (stopped || !listbox.isConnected) return;
      // Chips sometimes land after the menu, hence the reread after the waits
      const posed = tagNames(modal);
      const proposal = propose({ title: read.title, cats: found.cats, candidates, posed, memory });
      if (proposal === null) return;
      if (proposal.kind === 'hint') {
        const line = createLine(proposal.label);
        lines.add(line);
        listbox.prepend(line);
        return;
      }
      const { name } = proposal;
      proposed.set(read.title, name);
      // Reordering is CSS only: moving a native node would break the site's React tree.
      listbox.classList.add(REORDER);
      reordered.add(listbox);
      for (const option of listbox.children) classify(option, name);
    } catch (error) {
      if (!stopped) console.error('[Palimpseste] tag-proposal', error);
    }
  }

  const onListbox = (listbox: Element): void => {
    const modal = modalOf(listbox);
    if (modal === null) return;
    void resolve(listbox, modal, tagOptionLabels(listbox));
  };

  let pending: Snapshot[] = [];
  const onCard = (card: Element): void => {
    if (!isCollection() || inDetailModal(card)) return;
    const name = cardTitle(card);
    const tags = cardTags(card);
    if (name === null || tags === null) return;
    // A scan hands over every card of the page in one tick.
    if (pending.length === 0) {
      queueMicrotask(() => {
        const cards = pending;
        pending = [];
        void learner.learnMany(cards);
      });
    }
    pending.push({ title: name, tags });
  };

  const stops = [
    watch('card', FEATURE, onCard),
    watch('modal', FEATURE, onModal),
    watch('tagChip', FEATURE, onChip),
    watch('tagListbox', FEATURE, onListbox),
    watch('tagOption', FEATURE, onOption),
  ];

  return () => {
    stopped = true;
    pending = [];
    learner.stop();
    for (const stop of stops) stop();
    for (const option of classed) option.classList.remove(PROPOSED);
    classed.clear();
    for (const listbox of reordered) listbox.classList.remove(REORDER);
    reordered.clear();
    for (const line of lines) line.remove();
    lines.clear();
    proposed.clear();
  };
};
