import { anchors, bulkModalOf } from './dom/anchors';
import { queryAll } from './dom/query';

const KEYS = new Set(['ArrowDown', 'ArrowUp']);

// Recomputed on each key: the site's filter removes and adds buttons
const optionsOf = (modal: Element): HTMLElement[] =>
  (queryAll(anchors.bulkTagOption) as HTMLElement[]).filter(
    (button) => button.isConnected && !button.hidden && modal.contains(button),
  );

const searchOf = (modal: Element): HTMLElement | null =>
  (queryAll(anchors.bulkTagSearch).find((input) => modal.contains(input)) as
    HTMLElement | undefined) ?? null;

export const startTagBulkKeys = (): (() => void) => {
  const onKeydown = (event: KeyboardEvent): void => {
    if (!KEYS.has(event.key) || event.isComposing) return;
    if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
    if (!(event.target instanceof Element)) return;
    const modal = bulkModalOf(event.target);
    if (modal === null) return;

    const list = optionsOf(modal);
    const search = searchOf(modal);
    const down = event.key === 'ArrowDown';
    const current = event.target as HTMLElement;

    let next: HTMLElement | null | undefined;
    if (current === search) {
      if (!down) return;
      next = list[0];
    } else {
      const index = list.indexOf(current);
      if (index === -1) return;
      next = down ? (list[index + 1] ?? current) : index === 0 ? search : list[index - 1];
    }
    if (next === null || next === undefined) return;

    event.preventDefault();
    next.focus();
  };

  document.addEventListener('keydown', onKeydown);
  return () => document.removeEventListener('keydown', onKeydown);
};
