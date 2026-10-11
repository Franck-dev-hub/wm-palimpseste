import { query, queryAll } from './query';

export const anchors = {
  card: 'div.rounded-2xl[class*="glow-"]:has(h3)',
  modal: 'div.fixed.inset-0.z-50 > div.card-frame',
  revealed: 'main [class*="animate-card-flip"]',
  trade: `div.card-frame:has(button[aria-label="Voir le détail de l'échange"])`,
} as const satisfies Record<string, string>;

export type AnchorName = keyof typeof anchors;

const RARITY = /^glow-(c|pc|r|sr|ur|l)$/;
const PLACEHOLDER_ALT = 'WikiMasters';

export type Rarity = 'c' | 'pc' | 'r' | 'sr' | 'ur' | 'l';

export const rarity = (card: Element): Rarity | null => {
  for (const name of card.classList) {
    const match = RARITY.exec(name);
    if (match) return match[1] as Rarity;
  }
  return null;
};

export const isShiny = (card: Element): boolean => card.classList.contains('glow-shiny');

export const title = (card: Element): string | null => {
  const heading = query('h3', card)?.textContent.trim();
  if (heading) return heading;
  for (const img of queryAll('img[alt]', card)) {
    const alt = img.getAttribute('alt')?.trim();
    if (alt && alt !== PLACEHOLDER_ALT) return alt;
  }
  return null;
};

export const imageZone = (card: Element): Element | null =>
  query(':scope > div[class~="h-[45%]"]', card);

export const hasImage = (card: Element): boolean => {
  const zone = imageZone(card);
  return zone !== null && query(`img[alt="${PLACEHOLDER_ALT}"]`, zone) === null;
};

export const modalWikiLink = (modal: Element): Element | null =>
  query('a[href^="https://fr.wikipedia.org/wiki/"]', modal);

export const inDetailModal = (card: Element): boolean => card.closest(anchors.modal) !== null;
