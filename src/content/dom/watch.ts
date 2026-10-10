import { type AnchorName, anchors } from './anchors';
import { assertFeatureId, queryAll } from './query';

interface Entry {
  anchor: AnchorName;
  feature: string;
  handler: (el: Element) => void;
  injected: WeakMap<Element, Element[]>;
}

const registry = new Set<Entry>();

let observer: MutationObserver | null = null;
let pending: number | null = null;

const schedule = (): void => {
  if (pending !== null) return;
  pending = requestAnimationFrame(() => {
    pending = null;
    scan();
  });
};

const isOurs = (node: Node): boolean =>
  node instanceof Element && node.closest('[data-wmpal]') !== null;

const isOwnMutation = (record: MutationRecord): boolean =>
  isOurs(record.target) ||
  (record.removedNodes.length === 0 &&
    record.addedNodes.length > 0 &&
    [...record.addedNodes].every(isOurs));

const observe = (): void => {
  observer ??= new MutationObserver((records) => {
    if (!records.every(isOwnMutation)) schedule();
  });
  observer.observe(document.documentElement, { childList: true, subtree: true });
};

const marked = (el: Element, feature: string): Element[] => [
  ...el.querySelectorAll(`[data-wmpal="${feature}"]`),
];

const needsHandler = (entry: Entry, el: Element): boolean => {
  const nodes = entry.injected.get(el);
  if (nodes === undefined) return true;
  return nodes.length > 0 && nodes.every((node) => !el.contains(node));
};

const run = (entry: Entry, el: Element): void => {
  const before = new Set(marked(el, entry.feature));
  try {
    entry.handler(el);
  } catch (err) {
    console.error(`[Palimpseste] ${entry.feature}`, err);
  } finally {
    entry.injected.set(
      el,
      marked(el, entry.feature).filter((node) => !before.has(node)),
    );
  }
};

const removeMarked = (feature: string): void => {
  const before = observer?.takeRecords() ?? [];
  if (!before.every(isOwnMutation)) schedule();
  for (const node of document.querySelectorAll(`[data-wmpal="${feature}"]`)) node.remove();
  observer?.takeRecords();
};

const halt = (): void => {
  observer?.disconnect();
  observer?.takeRecords();
  if (pending !== null) cancelAnimationFrame(pending);
  pending = null;
};

export const scan = (): void => {
  for (const entry of [...registry]) {
    for (const el of queryAll(anchors[entry.anchor])) {
      if (!registry.has(entry)) break;
      if (needsHandler(entry, el)) run(entry, el);
    }
  }
};

export const watch = (
  anchor: AnchorName,
  feature: string,
  handler: (el: Element) => void,
): (() => void) => {
  assertFeatureId(feature);
  const entry: Entry = { anchor, feature, handler, injected: new WeakMap() };
  registry.add(entry);
  observe();
  scan();
  return () => {
    if (!registry.delete(entry)) return;
    if (registry.size === 0) halt();
    if ([...registry].some((other) => other.feature === feature)) return;
    removeMarked(feature);
  };
};
