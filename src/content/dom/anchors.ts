import { query, queryAll } from './query';

// French label of the site: on another language nothing matches and nothing is read.
const REMOVE_TAG = "Retirer l'étiquette ";
const CHIP = `span:has(> button[aria-label^="${REMOVE_TAG}"])`;
const WIKI_PREFIX = 'https://fr.wikipedia.org/wiki/';

// No text nor role: the detail modal field is a combobox, the result view has no field.
const BULK_MODAL = 'div.fixed.inset-0 > div.card-frame';
const BULK_SEARCH = 'input[maxlength="48"]:not([role])';

export const anchors = {
  card: 'div.rounded-2xl[class*="glow-"]:has(h3)',
  modal: 'div.fixed.inset-0.z-50 > div.card-frame',
  revealed: 'main [class*="animate-card-flip"]',
  // No text: the only direct button of the card-frame, first (R9)
  modalClose: 'div.fixed.inset-0.z-50 > div.card-frame > button[aria-label]:first-child',
  trade: `div.card-frame:has(button[aria-label="Voir le détail de l'échange"])`,
  tagChip: `div.fixed.inset-0.z-50 > div.card-frame ${CHIP}`,
  tagListbox: 'div.fixed.inset-0.z-50 > div.card-frame ul[role="listbox"]',
  tagOption: 'div.fixed.inset-0.z-50 > div.card-frame ul[role="listbox"] > li[role="option"]',
  tagCombobox: 'div.fixed.inset-0.z-50 > div.card-frame input[role="combobox"]',
  bulkTagModal: `${BULK_MODAL}:has(> div > ${BULK_SEARCH} + div)`,
  bulkTagSearch: `${BULK_MODAL} > div > ${BULK_SEARCH}`,
  bulkTagOption: `${BULK_MODAL} > div > ${BULK_SEARCH} + div > button[type="button"]`,
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

const CARD_TAGS = 'div.flex-wrap[class~="pb-0.5"] > span.rounded-full';
const OVERFLOW = /^\+\d+$/;

// A collection card without tag has no chip container; « +N » or an empty chip means the list is cut.
export const cardTags = (card: Element): string[] | null => {
  if (!card.matches(anchors.card) || inDetailModal(card)) return null;
  const names = queryAll(CARD_TAGS, card).map((chip) => chip.textContent.trim());
  return names.some((name) => name === '' || OVERFLOW.test(name)) ? null : names;
};

// One carousel on screen: several flipped nodes mean another view (e.g. a list)
export const revealedCard = (): Element | null => {
  const flips = queryAll(anchors.revealed);
  return flips.length === 1 ? (flips[0]?.firstElementChild ?? null) : null;
};

// Without getAnimations (jsdom) no animation is seen: the card counts as flipped
export const isFlipping = (card: Element): boolean => {
  const flip = card.parentElement;
  if (flip === null || !('getAnimations' in flip)) return false;
  return flip
    .getAnimations({ subtree: true })
    .some((animation) => 'animationName' in animation && animation.playState === 'running');
};

export const REVEAL_MARK = 'data-wmpal-tag-reveal';

export const isRevealWindow = (modal: Element): boolean => modal.hasAttribute(REVEAL_MARK);

// The block's « Étiquettes » title, the only visible part of the folded drawer
export const tagTitleOf = (block: Element): Element | null => query(':scope > p', block);

export const isTextField = (el: Element): boolean =>
  el.matches('input, textarea, select, [contenteditable]');

export const tagListOf = (block: Element): Element | null =>
  queryAll(anchors.tagListbox).find((list) => block.contains(list)) ?? null;

export const hasTagListbox = (block: Element): boolean => tagListOf(block) !== null;

export const openModals = (): Element[] => queryAll(anchors.modal);

export const closeButtonOf = (modal: Element): Element | null =>
  queryAll(anchors.modalClose).find((button) => modal.contains(button)) ?? null;

export const modalOf = (el: Element): Element | null => el.closest(anchors.modal);

export const bulkModalOf = (el: Element): Element | null => {
  const modal = el.closest(BULK_MODAL);
  return modal?.matches(anchors.bulkTagModal) ? modal : null;
};

export const tagBlockOf = (modal: Element): Element | null =>
  queryAll(anchors.tagCombobox).find((input) => modal.contains(input))?.parentElement
    ?.parentElement ?? null;

export const modalTitle = (modal: Element): string | null => {
  const href = modalWikiLink(modal)?.getAttribute('href');
  if (href?.startsWith(WIKI_PREFIX)) {
    try {
      const name = decodeURIComponent(href.slice(WIKI_PREFIX.length)).replaceAll('_', ' ').trim();
      if (name) return name;
    } catch {
      // malformed escape: use the card title instead
    }
  }
  const card = query(anchors.card, modal);
  return card === null ? null : title(card);
};

export const tagChipName = (chip: Element): string | null => {
  const label = query('button[aria-label]', chip)?.getAttribute('aria-label');
  if (!label?.startsWith(REMOVE_TAG)) return null;
  return label.slice(REMOVE_TAG.length).trim() || null;
};

export const tagNames = (modal: Element): string[] =>
  queryAll(CHIP, modal).flatMap((chip) => tagChipName(chip) ?? []);

export const isCreateOption = (option: Element): boolean =>
  query(':scope > div > label > input[type="color"]', option) !== null;

export const tagOptionLabel = (option: Element): string | null => {
  if (isCreateOption(option)) return null;
  const row = query(':scope > button > span', option);
  if (row === null) return null;
  const label = [...row.childNodes]
    .filter((node) => node.nodeType === Node.TEXT_NODE)
    .map((node) => node.textContent)
    .join('')
    .trim();
  return label || null;
};

export const tagOptionLabels = (listbox: Element): string[] =>
  [...listbox.children].flatMap((option) => tagOptionLabel(option) ?? []);

export const cardDescription = (card: Element): string | null => {
  const text = query('h3 ~ p', card)?.textContent.replaceAll(/\s+/g, ' ').trim();
  return text === undefined || text === '' ? null : text;
};

export const optionDescription = (option: Element): string | null => {
  const modal = option.closest(anchors.modal);
  const card = modal === null ? null : query(anchors.card, modal);
  return card === null ? null : cardDescription(card);
};
