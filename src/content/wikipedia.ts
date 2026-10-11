import { ext } from '../shared/ext';
import { inDetailModal, title } from './dom/anchors';
import { mark } from './dom/query';
import { watch } from './dom/watch';
import type { Start } from './features';
import './wikipedia.css';

export const wikipediaUrl = (title: string): string =>
  'https://fr.wikipedia.org/wiki/' + encodeURIComponent(title.replaceAll(' ', '_'));

export const contentMessageKeys = ['wikipediaOpen'] as const;

const STOPPED = ['click', 'auxclick', 'pointerdown', 'mousedown', 'keydown'];
const REFRESHED = ['pointerdown', 'focus', 'keydown'];

const listen = (badge: HTMLAnchorElement, card: Element): void => {
  const handle = (event: Event): void => {
    if (STOPPED.includes(event.type)) event.stopPropagation();
    if (!REFRESHED.includes(event.type)) return;
    const name = title(card);
    if (name !== null) badge.href = wikipediaUrl(name);
  };
  for (const type of new Set([...STOPPED, ...REFRESHED])) badge.addEventListener(type, handle);
};

const inject = (card: Element): void => {
  const name = title(card);
  if (inDetailModal(card) || name === null) return;

  const label = ext.i18n.getMessage(contentMessageKeys[0]);
  const badge = document.createElement('a');
  badge.className = 'wmpal-wiki';
  badge.textContent = 'W';
  badge.href = wikipediaUrl(name);
  badge.target = '_blank';
  badge.rel = 'noopener noreferrer';
  badge.title = label;
  badge.setAttribute('aria-label', label);
  badge.draggable = false;
  mark(badge, 'wikipedia');
  listen(badge, card);
  card.append(badge);
};

export const startWikipedia: Start = () => watch('card', 'wikipedia', inject);
