import { anchors, bulkModalOf } from './dom/anchors';
import { mark, query, queryAll } from './dom/query';
import { createFailureNode, MESSAGE_MS, ROLLBACK_MS } from './tag-rollback';

const FEATURE = 'tag-menu';

interface Check {
  modal: Element;
  button: Element;
  node: HTMLElement;
  timer: ReturnType<typeof setTimeout>;
}

// Créer row: an unstyled word before the chip
const isCreateRow = (button: Element): boolean =>
  query(':scope > span:not([style]):has(+ span[style])', button) !== null;

export const startTagBulkCheck = (): (() => void) => {
  const checks = new Set<Check>();
  const messages = new Map<Element, { node: Element; timer: ReturnType<typeof setTimeout> }>();

  const drop = (check: Check): void => {
    clearTimeout(check.timer);
    checks.delete(check);
    check.node.remove();
  };

  const clearMessage = (modal: Element): void => {
    const shown = messages.get(modal);
    if (shown === undefined) return;
    clearTimeout(shown.timer);
    shown.node.remove();
    messages.delete(modal);
  };

  const showFailure = (modal: Element): void => {
    clearMessage(modal);
    const search = queryAll(anchors.bulkTagSearch).find((input) => modal.contains(input));
    if (search === undefined) return;
    const node = createFailureNode(FEATURE);
    search.before(node);
    messages.set(modal, { node, timer: setTimeout(() => clearMessage(modal), MESSAGE_MS) });
  };

  const expire = (check: Check): void => {
    const { modal } = check;
    drop(check);
    if (isPending(check)) showFailure(modal);
  };

  // Result view: the field is gone from the modal
  const isPending = (check: Check): boolean =>
    check.modal.isConnected &&
    check.button.isConnected &&
    queryAll(anchors.bulkTagSearch).some((input) => check.modal.contains(input));

  const onClick = (event: Event): void => {
    const target = event.target;
    if (!(target instanceof Node)) return;
    const button = queryAll(anchors.bulkTagOption).find((option) => option.contains(target));
    if (button === undefined || isCreateRow(button)) return;
    const modal = bulkModalOf(button);
    if (modal === null) return;
    if ([...checks].some((check) => check.button === button)) return;

    // Last child of the button: React leaves alone a node it does not know
    const node = document.createElement('span');
    node.className = 'wmpal-bulk-check';
    mark(node, FEATURE);
    node.setAttribute('aria-hidden', 'true');
    node.textContent = '✓';
    button.append(node);
    const check: Check = { modal, button, node, timer: 0 as never };
    check.timer = setTimeout(() => expire(check), ROLLBACK_MS);
    checks.add(check);
  };

  const observer = new MutationObserver(() => {
    for (const check of [...checks]) if (!isPending(check)) drop(check);
    for (const [modal] of messages) if (!modal.isConnected) clearMessage(modal);
  });
  observer.observe(document.documentElement, { childList: true, subtree: true });
  document.addEventListener('click', onClick, { capture: true, passive: true });

  return () => {
    document.removeEventListener('click', onClick, { capture: true });
    observer.disconnect();
    for (const check of [...checks]) drop(check);
    for (const [modal] of [...messages]) clearMessage(modal);
  };
};
