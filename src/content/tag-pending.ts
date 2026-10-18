import {
  anchors,
  isCreateOption,
  modalOf,
  tagBlockOf,
  tagNames,
  tagOptionLabel,
} from './dom/anchors';
import { mark, query, queryAll } from './dom/query';
import { createFailureNode, FAILURE_KEY, MESSAGE_MS, ROLLBACK_MS } from './tag-rollback';

export const contentMessageKeys = [FAILURE_KEY] as const;

const FEATURE = 'tag-menu';

interface Pending {
  frame: Element;
  block: Element;
  name: string;
  chip: HTMLElement;
  row: Element;
  timer: ReturnType<typeof setTimeout>;
}

const holderOf = (block: Element): Element | null =>
  query('input[role="combobox"]', block)?.parentElement ?? null;

const createChip = (name: string, option: Element): HTMLElement => {
  const chip = document.createElement('span');
  chip.className = 'wmpal-pending-chip';
  mark(chip, FEATURE);
  const color = (query('[aria-hidden="true"]', option) as HTMLElement | null)?.style
    .backgroundColor;
  if (color) {
    const dot = document.createElement('span');
    dot.setAttribute('aria-hidden', 'true');
    dot.style.backgroundColor = color;
    chip.append(dot);
  }
  chip.append(name);
  return chip;
};

const createZone = (): HTMLElement => {
  const node = document.createElement('div');
  node.className = 'wmpal-pending-zone';
  mark(node, FEATURE);
  return node;
};

const ownZoneOf = (block: Element): Element | null => {
  const zone = holderOf(block)?.previousElementSibling;
  return zone?.classList.contains('wmpal-pending-zone') ? zone : null;
};

// The native chip area, missing until a chip is posed
const chipsZoneOf = (block: Element): Element | null => {
  const zone = holderOf(block)?.previousElementSibling;
  return zone?.tagName === 'DIV' && !zone.hasAttribute('data-wmpal') ? zone : null;
};

export const startTagPending = (): (() => void) => {
  const items = new Set<Pending>();
  const messages = new Map<Element, { node: Element; timer: ReturnType<typeof setTimeout> }>();

  const syncBlock = (block: Element): void => {
    const names = [...items].filter((item) => item.block === block).map((item) => item.name);
    if (names.length === 0) block.removeAttribute('data-wmpal-pending');
    else block.setAttribute('data-wmpal-pending', names.join('|'));
  };

  const drop = (item: Pending): void => {
    clearTimeout(item.timer);
    items.delete(item);
    const zone = item.chip.parentElement;
    item.chip.remove();
    if (zone?.classList.contains('wmpal-pending-zone') && zone.childElementCount === 0)
      zone.remove();
    item.row.removeAttribute('data-wmpal-pending-row');
    syncBlock(item.block);
  };

  const clearMessage = (block: Element): void => {
    const shown = messages.get(block);
    if (shown === undefined) return;
    clearTimeout(shown.timer);
    shown.node.remove();
    messages.delete(block);
  };

  const showFailure = (block: Element): void => {
    clearMessage(block);
    const node = createFailureNode(FEATURE);
    const holder = holderOf(block);
    if (holder?.parentElement === block) holder.before(node);
    else block.append(node);
    messages.set(block, { node, timer: setTimeout(() => clearMessage(block), MESSAGE_MS) });
  };

  const expire = (item: Pending): void => {
    const alive = item.frame.isConnected;
    drop(item);
    if (alive && !tagNames(item.frame).includes(item.name)) showFailure(item.block);
  };

  const onClick = (event: Event): void => {
    const target = event.target;
    const option =
      target instanceof Node
        ? queryAll(anchors.tagOption).find((li) => li.contains(target))
        : undefined;
    if (option === undefined || isCreateOption(option)) return;
    const name = tagOptionLabel(option);
    const frame = modalOf(option);
    const block = frame === null ? null : tagBlockOf(frame);
    if (name === null || frame === null || block === null) return;
    if (tagNames(frame).includes(name)) return;
    if ([...items].some((item) => item.frame === frame && item.name === name)) return;

    const chip = createChip(name, option);
    const native = chipsZoneOf(block);
    if (native !== null) {
      native.append(chip);
    } else {
      let zone = ownZoneOf(block);
      if (zone === null) {
        // Our sibling before the field: React owns the block, never move a node
        zone = createZone();
        holderOf(block)?.before(zone);
      }
      zone.append(chip);
    }
    option.setAttribute('data-wmpal-pending-row', '');
    const item: Pending = { frame, block, name, chip, row: option, timer: 0 as never };
    item.timer = setTimeout(() => expire(item), ROLLBACK_MS);
    items.add(item);
    syncBlock(block);
  };

  const observer = new MutationObserver(() => {
    for (const item of [...items]) {
      if (!item.frame.isConnected) {
        drop(item);
        continue;
      }
      if (tagNames(item.frame).includes(item.name)) drop(item);
    }
    for (const [block] of messages) if (!block.isConnected) clearMessage(block);
  });
  observer.observe(document.documentElement, { childList: true, subtree: true });
  document.addEventListener('click', onClick, { capture: true, passive: true });

  return () => {
    document.removeEventListener('click', onClick, { capture: true });
    observer.disconnect();
    for (const item of [...items]) drop(item);
    for (const [block] of [...messages]) clearMessage(block);
  };
};
