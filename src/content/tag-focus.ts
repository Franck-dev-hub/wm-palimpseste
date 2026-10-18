import {
  anchors,
  hasTagListbox,
  isRevealWindow,
  isTextField,
  REVEAL_MARK,
  modalOf,
  tagBlockOf,
} from './dom/anchors';
import { mediaMatches, query, queryAll } from './dom/query';
import { watch } from './dom/watch';

// Same threshold as the tag-menu.css column, and the tablet virtual keyboard stays closed
const DESKTOP = '(min-width: 64rem)';

const chipCount = (block: Element): number =>
  queryAll(anchors.tagChip).filter((chip) => block.contains(chip)).length;

const comboboxIn = (block: Element): HTMLElement | null =>
  (query('input[role="combobox"]', block) as HTMLElement | null) ?? null;

// Never steal the focus from another field
const mayTakeFocus = (block: Element): boolean => {
  const active = document.activeElement;
  return (
    active === null || active === document.body || !active.isConnected || block.contains(active)
  );
};

const focusCombobox = (frame: Element): void => {
  const block = tagBlockOf(frame);
  if (block === null || !mediaMatches(DESKTOP) || !mayTakeFocus(block)) return;
  comboboxIn(block)?.focus({ preventScroll: true });
};

// The native list only exists while the field is open: at reveal, focus it whatever the active element
const focusRevealCombobox = (frame: Element): void => {
  const block = tagBlockOf(frame);
  if (block !== null) comboboxIn(block)?.focus({ preventScroll: true });
};

const otherFieldFocused = (block: Element): boolean => {
  const active = document.activeElement;
  return active !== null && !block.contains(active) && isTextField(active);
};

export const startTagFocus = (): (() => void) => {
  const opened = new WeakSet<Element>();
  const counts = new WeakMap<Element, number>();
  const tracked = new Set<Element>();
  const risen = new Set<Element>();
  const awaitingMark = new Set<Element>();
  let raf: number | null = null;

  // The site focuses body after the mutation: decide one frame later
  const flush = (): void => {
    raf = null;
    for (const frame of risen) if (frame.isConnected) focusCombobox(frame);
    risen.clear();
    for (const frame of awaitingMark)
      if (frame.isConnected && isRevealWindow(frame)) focusRevealCombobox(frame);
    awaitingMark.clear();
    // Only our latest window takes the list back, the old one is closing
    const latest = [...tracked]
      .reverse()
      .find((frame) => frame.isConnected && isRevealWindow(frame));
    const block = latest === undefined ? null : tagBlockOf(latest);
    if (
      latest !== undefined &&
      block !== null &&
      !hasTagListbox(block) &&
      !otherFieldFocused(block)
    )
      focusRevealCombobox(latest);
  };

  const observer = new MutationObserver(() => {
    for (const frame of tracked) {
      if (!frame.isConnected) {
        tracked.delete(frame);
        continue;
      }
      const block = tagBlockOf(frame);
      if (block === null) continue;
      const count = chipCount(block);
      if (count > (counts.get(frame) ?? count)) risen.add(frame);
      counts.set(frame, count);
    }
    if (
      raf === null &&
      (risen.size > 0 || awaitingMark.size > 0 || [...tracked].some(isRevealWindow))
    )
      raf = requestAnimationFrame(flush);
  });
  observer.observe(document.documentElement, {
    childList: true,
    subtree: true,
    attributes: true,
    // disabled: set during « Chargement… », re-enabling the field adds no node
    attributeFilter: [REVEAL_MARK, 'disabled'],
  });

  const stopWatch = watch('tagCombobox', 'tag-focus', (input) => {
    const frame = modalOf(input);
    if (frame === null || opened.has(frame)) return;
    opened.add(frame);
    tracked.add(frame);
    const block = tagBlockOf(frame);
    if (block !== null) counts.set(frame, chipCount(block));
    focusCombobox(frame);
    awaitingMark.add(frame);
    raf ??= requestAnimationFrame(flush);
  });

  return () => {
    stopWatch();
    observer.disconnect();
    if (raf !== null) cancelAnimationFrame(raf);
    raf = null;
    risen.clear();
    awaitingMark.clear();
    tracked.clear();
  };
};
