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
