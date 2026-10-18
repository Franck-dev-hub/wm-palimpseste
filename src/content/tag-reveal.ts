import {
  closeButtonOf,
  isFlipping,
  openModals,
  REVEAL_MARK,
  revealedCard,
  tagBlockOf,
  tagTitleOf,
  tagListOf,
  title,
} from './dom/anchors';
import { mediaMatches } from './dom/query';
import { features } from '../shared/features';
import { onSettingsChanged, readSettings } from '../shared/settings';
import type { Start } from './features';
import { rootPx, tagRowsFor } from './tag-menu';
import './tag-reveal.css';

const ATTR = REVEAL_MARK;
const VARS = {
  top: '--wmpal-reveal-top',
  right: '--wmpal-reveal-right',
  rows: '--wmpal-reveal-rows',
};
// Measured: the window opens in ~28 ms, 1 s covers a slow machine without marking a player's window
const OPEN_WAIT_MS = 1000;
// Q35: below this width the drawer comes folded, each new window starts without this value
const DESKTOP = '(min-width: 64rem)';
const UNFOLDED = 'open';

interface Shown {
  card: Element;
  name: string | null;
}

const same = (a: Shown | null, b: Shown | null): boolean =>
  a !== null && b !== null && a.card === b.card && a.name === b.name;

const engage = (): (() => void) => {
  const root = document.documentElement;
  // Windows we opened, the only ones we may close
  const ours = new Set<Element>();
  // Windows we closed that are still in the DOM: they are not the player's
  const closing = new Set<Element>();
  let current: Shown | null = null;
  // Card already handled: window opened, or left to the player's
  let handled: Shown | null = null;
  let waiting: ReturnType<typeof setTimeout> | null = null;

  const stopWaiting = (): void => {
    if (waiting !== null) clearTimeout(waiting);
    waiting = null;
  };

  const close = (frame: Element): void => {
    ours.delete(frame);
    if (!frame.isConnected) return;
    // Marker kept: the window stays hidden while it leaves
    closing.add(frame);
    (closeButtonOf(frame) as HTMLElement | null)?.click();
  };

  // Q33: one column if it fits, else columns over the full height
  const setRect = (card: Element): void => {
    const rect = card.getBoundingClientRect();
    const margin = rootPx();
    const room = window.innerHeight - 2 * margin;
    const frame = [...ours].at(-1);
    const block = frame === undefined ? null : tagBlockOf(frame);
    const list = block === null ? null : tagListOf(block);
    // Margins included: the Wikidata hint has a bottom margin getBoundingClientRect ignores
    const heights =
      list === null
        ? []
        : [...list.children].map((item) => {
            const style = getComputedStyle(item);
            return (
              item.getBoundingClientRect().height +
              (Number.parseFloat(style.marginTop) || 0) +
              (Number.parseFloat(style.marginBottom) || 0)
            );
          });
    const row = Math.max(0, ...heights);
    let rows = tagRowsFor(room);
    let top = Math.max(margin, rect.top);
    if (block !== null && list !== null && row > 0) {
      // scrollHeight since max-height may clip the block, plus its borders
      const reserve =
        block.scrollHeight +
        ((block as HTMLElement).offsetHeight - block.clientHeight) -
        list.getBoundingClientRect().height;
      const column = heights.reduce((sum, height) => sum + height, 0);
      const fits = reserve + column <= room;
      // Tallest row: every column fits whatever its content
      rows = fits ? heights.length : Math.max(1, Math.floor((room - reserve) / row));
      top = Math.max(margin, Math.min(top, window.innerHeight - margin - reserve - column));
      if (!fits) top = margin;
    }
    root.style.setProperty(VARS.top, `${top}px`);
    root.style.setProperty(VARS.right, `${rect.right}px`);
    root.style.setProperty(VARS.rows, String(rows));
  };

  const clearRect = (): void => {
    for (const name of Object.values(VARS)) root.style.removeProperty(name);
  };

  // The click opens the window at once or on the next render: mark the first one that shows
  const adopt = (): void => {
    if (waiting === null) return;
    const frame = openModals().find((modal) => !closing.has(modal));
    if (frame === undefined) return;
    stopWaiting();
    frame.setAttribute(ATTR, '');
    ours.add(frame);
  };

  const sync = (): void => {
    for (const set of [ours, closing])
      for (const frame of set) if (!frame.isConnected) set.delete(frame);
    adopt();

    const card = revealedCard();
    const shown = card === null ? null : { card, name: title(card) };
    // As soon as the card changes: the old card's window must never stay open
    if (!same(shown, current)) for (const frame of [...ours]) close(frame);
    current = shown;
    if (card === null || shown === null) {
      handled = null;
      stopWaiting();
      clearRect();
      return;
    }
    if (isFlipping(card)) return;
    setRect(card);
    if (same(shown, handled) || ours.size > 0) return;
    // Closing: the mutation of its removal runs sync again
    if (closing.size > 0) return;
    if (openModals().length > 0) {
      if (waiting === null) handled = shown;
      return;
    }
    handled = shown;
    stopWaiting();
    waiting = setTimeout(stopWaiting, OPEN_WAIT_MS);
    (card as HTMLElement).click();
    adopt();
  };

  // Q35: a tap unfolds the block, only its title folds it. The card unfolds, any other tap folds
  const fold = (event: MouseEvent): void => {
    if (mediaMatches(DESKTOP) || !(event.target instanceof Element)) return;
    const target = event.target;
    const frame = [...ours].at(-1);
    const block = frame === undefined ? null : tagBlockOf(frame);
    if (frame === undefined || block === null) return;
    const unfolded = frame.getAttribute(ATTR) === UNFOLDED;
    if (block.contains(target)) {
      if (!unfolded) frame.setAttribute(ATTR, UNFOLDED);
      else if (tagTitleOf(block)?.contains(target) === true) frame.setAttribute(ATTR, '');
    } else if ((current?.card.parentElement ?? current?.card)?.contains(target) === true) {
      // Container included: if it captures the pointer for swipes, the click lands there
      // Its window is already open and hidden: reopening it could show it without the marker
      event.stopPropagation();
      event.preventDefault();
      frame.setAttribute(ATTR, UNFOLDED);
    } else if (unfolded) frame.setAttribute(ATTR, '');
  };
  document.addEventListener('click', fold, true);

  const observer = new MutationObserver(sync);
  observer.observe(document.documentElement, {
    childList: true,
    subtree: true,
    characterData: true,
  });
  document.addEventListener('animationend', sync, true);
  document.addEventListener('animationcancel', sync, true);
  const refresh = (): void => {
    if (current !== null && !isFlipping(current.card)) setRect(current.card);
  };
  window.addEventListener('resize', refresh, { passive: true });
  window.addEventListener('scroll', refresh, { passive: true, capture: true });
  sync();

  return () => {
    observer.disconnect();
    document.removeEventListener('animationend', sync, true);
    document.removeEventListener('animationcancel', sync, true);
    document.removeEventListener('click', fold, true);
    window.removeEventListener('resize', refresh);
    window.removeEventListener('scroll', refresh, true);
    stopWaiting();
    for (const frame of [...ours]) close(frame);
    for (const frame of closing) frame.removeAttribute(ATTR);
    closing.clear();
    clearRect();
  };
};

// Without the T19 menu the panel is not styled: the window would open for nothing
const GATE = 'tag-menu';

export const startTagReveal: Start = () => {
  let disengage: (() => void) | null = null;
  let stopped = false;

  const apply = (enabled: boolean): void => {
    if (stopped) return;
    if (enabled && disengage === null) disengage = engage();
    else if (!enabled && disengage !== null) {
      disengage();
      disengage = null;
    }
  };

  let settled = false;
  const unsubscribe = onSettingsChanged(features, (settings) => {
    settled = true;
    apply(settings.features[GATE] === true);
  });
  void readSettings(features).then((settings) => {
    if (!settled) apply(settings.features[GATE] === true);
  });

  return () => {
    stopped = true;
    unsubscribe();
    disengage?.();
    disengage = null;
  };
};
