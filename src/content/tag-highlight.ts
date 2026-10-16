import { optionDescription, tagOptionLabel } from './dom/anchors';
import { watch } from './dom/watch';
import type { Start } from './features';
import './tags.css';

const CLASS = 'wmpal-in-description';

const escape = (text: string): string => text.replaceAll(/[.*+?^${}()|[\]\\]/g, '\\$&');

// Unicode letters and digits bound the name, so « Art » skips « Artiste ».
export const mentions = (description: string, name: string): boolean =>
  new RegExp(`(?<![\\p{L}\\p{N}])${escape(name.normalize('NFC'))}(?![\\p{L}\\p{N}])`, 'iu').test(
    description.normalize('NFC'),
  );

export const startTagHighlight: Start = () => {
  const marked = new Set<Element>();

  const highlight = (option: Element): void => {
    for (const el of marked) if (!el.isConnected) marked.delete(el);
    const name = tagOptionLabel(option);
    const description = optionDescription(option);
    if (name === null || description === null || !mentions(description, name)) return;
    option.classList.add(CLASS);
    marked.add(option);
  };

  const stop = watch('tagOption', 'tag-highlight', highlight);

  return () => {
    stop();
    for (const el of marked) el.classList.remove(CLASS);
    marked.clear();
  };
};
