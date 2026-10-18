import { describe, expect, it } from 'vitest';
import en from '../../src/_locales/en/messages.json';
import fr from '../../src/_locales/fr/messages.json';
import manifest from '../../src/manifest.json';
import optionsHtml from '../../src/options/options.html?raw';
import { contentMessageKeys as tagPendingKeys } from '../../src/content/tag-pending';
import { contentMessageKeys as tagProposalKeys } from '../../src/content/tag-proposal';
import { contentMessageKeys as wikipediaKeys } from '../../src/content/wikipedia';
import { features, type Feature } from '../../src/shared/features';

type Messages = Record<string, { message: string }>;

const manifestKeys = (source: string): string[] => [
  ...new Set([...source.matchAll(/__MSG_(\w+)__/g)].map((match) => match[1]!)),
];

const featureKeys = (registry: readonly Feature[]): string[] =>
  registry.flatMap(({ nameKey, descriptionKey }) => [nameKey, descriptionKey]);

const htmlKeys = (source: string): string[] => [
  ...new Set(
    [...new DOMParser().parseFromString(source, 'text/html').querySelectorAll('[data-i18n]')].map(
      (element) => element.getAttribute('data-i18n')!,
    ),
  ),
];

const requiredKeys = [
  ...manifestKeys(JSON.stringify(manifest)),
  ...featureKeys(features),
  ...htmlKeys(optionsHtml),
  ...wikipediaKeys,
  ...tagPendingKeys,
  ...tagProposalKeys,
];

const localeErrors = (locales: Record<string, Messages>, required: readonly string[]): string[] => {
  const errors: string[] = [];
  const all = new Set(Object.values(locales).flatMap((messages) => Object.keys(messages)));
  for (const [locale, messages] of Object.entries(locales)) {
    for (const key of new Set([...required, ...all])) {
      if (!(key in messages)) errors.push(`${locale}: missing ${key}`);
    }
    for (const [key, { message }] of Object.entries(messages)) {
      if (!message.trim()) errors.push(`${locale}: empty ${key}`);
    }
  }
  return errors;
};

const locales = { fr, en };

describe('locales', () => {
  it('cover the same keys, with every required key and no empty message', () => {
    expect(localeErrors(locales, requiredKeys)).toEqual([]);
  });

  it('require the manifest keys', () => {
    expect(requiredKeys).toEqual(expect.arrayContaining(['extName', 'extDescription']));
  });

  it('extracts the keys of a manifest source', () => {
    expect(manifestKeys('{"a":"__MSG_x__","b":"__MSG_y__","c":"__MSG_x__"}')).toEqual(['x', 'y']);
  });

  it('extracts the data-i18n keys of an html source', () => {
    const source = '<h1 data-i18n="a"></h1><p data-i18n="b"></p><i data-i18n="a"></i>';
    expect(htmlKeys(source)).toEqual(['a', 'b']);
  });

  it('require the options page keys', () => {
    expect(requiredKeys).toEqual(expect.arrayContaining(['optionsTitle', 'optionsEmpty']));
  });

  it('require the content script keys', () => {
    expect(requiredKeys).toEqual(expect.arrayContaining(['wikipediaOpen', 'tagProposalHint']));
  });

  it('extracts the keys of a feature registry', () => {
    const feature = { id: 'a', nameKey: 'aName', descriptionKey: 'aDesc', default: true };
    expect(featureKeys([feature])).toEqual(['aName', 'aDesc']);
  });

  it('catches a key missing from one locale', () => {
    const bad = { fr: { a: { message: 'x' }, b: { message: 'y' } }, en: { a: { message: 'x' } } };
    expect(localeErrors(bad, [])).toEqual(['en: missing b']);
  });

  it('catches a required key missing everywhere', () => {
    const bad = { fr: { a: { message: 'x' } }, en: { a: { message: 'x' } } };
    expect(localeErrors(bad, ['z'])).toEqual(['fr: missing z', 'en: missing z']);
  });

  it('catches an empty message', () => {
    const bad = { fr: { a: { message: ' ' } }, en: { a: { message: 'x' } } };
    expect(localeErrors(bad, [])).toEqual(['fr: empty a']);
  });
});
