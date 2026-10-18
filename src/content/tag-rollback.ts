import { ext } from '../shared/ext';
import { mark } from './dom/query';

export const FAILURE_KEY = 'tagMenuFailed';
// Measured at ~184 ms: 10 s absorbs network spikes
export const ROLLBACK_MS = 10_000;
export const MESSAGE_MS = 2_000;

export const createFailureNode = (feature: string): HTMLElement => {
  const node = document.createElement('div');
  node.className = 'wmpal-pending-message';
  mark(node, feature);
  node.setAttribute('role', 'status');
  node.textContent = ext.i18n.getMessage(FAILURE_KEY);
  return node;
};
