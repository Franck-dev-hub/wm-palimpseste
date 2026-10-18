import { anchors, bulkModalOf, modalOf } from './dom/anchors';
import { queryAll } from './dom/query';
import { watch } from './dom/watch';
import type { Start } from './features';
import { startTagBulkCheck } from './tag-bulk-check';
import { startTagBulkKeys } from './tag-bulk-keys';
import { startTagFocus } from './tag-focus';
import { startTagPending } from './tag-pending';
import './tag-menu.css';

const ATTR = 'data-wmpal-tag-menu';
const ROWS_VAR = '--wmpal-tag-rows';
const ROW_REM = 2.25;
// Panel height outside the list, matches the CSS calc
const RESERVE_REM = 11;
const FALLBACK_ROOT_PX = 16;

const kindOf = (frame: Element): 'detail' | 'bulk' | null => {
  if (bulkModalOf(frame) === frame) return 'bulk';
  const hasCombobox = queryAll(anchors.tagCombobox).some((input) => frame.contains(input));
  return modalOf(frame) === frame && hasCombobox ? 'detail' : null;
};

export const rootPx = (): number =>
  Number.parseFloat(getComputedStyle(document.documentElement).fontSize) || FALLBACK_ROOT_PX;

export const tagRowsFor = (panelPx: number): number =>
  Math.max(1, Math.floor((panelPx - RESERVE_REM * rootPx()) / (ROW_REM * rootPx())));

const syncRows = (): void => {
  document.documentElement.style.setProperty(
    ROWS_VAR,
    String(tagRowsFor(window.innerHeight * 0.9)),
  );
};

export const startTagMenu: Start = () => {
  const marked = new Set<Element>();

  const sync = (frame: Element): void => {
    // A detached modal keeps its anchors through closest: without this check it stays tracked
    const kind = frame.isConnected ? kindOf(frame) : null;
    if (kind === null) {
      frame.removeAttribute(ATTR);
      marked.delete(frame);
      return;
    }
    if (frame.getAttribute(ATTR) !== kind) frame.setAttribute(ATTR, kind);
    marked.add(frame);
  };

  const stopCombobox = watch('tagCombobox', 'tag-menu', (input) => {
    const frame = modalOf(input);
    if (frame !== null) sync(frame);
  });
  const stopBulk = watch('bulkTagModal', 'tag-menu', sync);
  const stopFocus = startTagFocus();
  const stopPending = startTagPending();
  const stopBulkKeys = startTagBulkKeys();
  const stopBulkCheck = startTagBulkCheck();

  // watch does not report a node that stops matching (result view in place)
  const observer = new MutationObserver(() => {
    for (const frame of marked) sync(frame);
  });
  observer.observe(document.documentElement, { childList: true, subtree: true });

  // Firefox ignores max-height with repeat(auto-fit), so the row count comes from the screen height
  syncRows();
  window.addEventListener('resize', syncRows, { passive: true });

  return () => {
    stopCombobox();
    stopBulk();
    stopFocus();
    stopPending();
    stopBulkKeys();
    stopBulkCheck();
    observer.disconnect();
    window.removeEventListener('resize', syncRows);
    document.documentElement.style.removeProperty(ROWS_VAR);
    for (const frame of marked) frame.removeAttribute(ATTR);
    marked.clear();
  };
};
