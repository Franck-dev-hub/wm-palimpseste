import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import manifest from '../../src/manifest.json';

const id = manifest.browser_specific_settings.gecko.id;

describe('manifest gecko id', () => {
  it('matches the AMO format', () => {
    expect(id).toMatch(/^[a-zA-Z0-9-._]*@[a-zA-Z0-9-._]+$/);
  });

  it('is at most 80 characters', () => {
    expect(id.length).toBeLessThanOrEqual(80);
  });

  it('is not a placeholder domain', () => {
    expect(id.endsWith('exemple.local')).toBe(false);
  });
});

describe('manifest data collection', () => {
  it('declares the card titles sent to Wikidata', () => {
    expect(manifest.browser_specific_settings.gecko.data_collection_permissions.required).toEqual([
      'websiteContent',
    ]);
  });
});

const icons = manifest.icons;
const pngSignature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

describe('manifest icons', () => {
  it('declares exactly the sizes 16, 48 and 128', () => {
    expect(Object.keys(icons).sort((a, b) => Number(a) - Number(b))).toEqual(['16', '48', '128']);
  });

  it.each(Object.entries(icons))('size %s points to an existing file', (_size, path) => {
    expect(() => readFileSync(resolve('src', path))).not.toThrow();
  });

  it.each(Object.entries(icons))('size %s has matching PNG dimensions', (size, path) => {
    const png = readFileSync(resolve('src', path));
    expect(png.subarray(0, 8).equals(pngSignature)).toBe(true);
    expect(png.readUInt32BE(16)).toBe(Number(size));
    expect(png.readUInt32BE(20)).toBe(Number(size));
  });
});
