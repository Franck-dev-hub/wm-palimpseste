import { describe, expect, it } from 'vitest';
import { assertFeatureId } from '../content/dom/query';
import { features, type Feature } from './features';

const registryErrors = (registry: readonly Feature[]): string[] => {
  const errors: string[] = [];
  const seen = new Set<string>();
  for (const { id } of registry) {
    try {
      assertFeatureId(id);
    } catch {
      errors.push(`invalid id: ${id}`);
    }
    if (seen.has(id)) errors.push(`duplicate id: ${id}`);
    seen.add(id);
  }
  return errors;
};

const fake = (id: string): Feature => ({
  id,
  nameKey: `${id}Name`,
  descriptionKey: `${id}Description`,
  default: true,
});

describe('feature registry', () => {
  it('has only valid, unique ids', () => {
    expect(registryErrors(features)).toEqual([]);
  });

  it('accepts a valid registry', () => {
    expect(registryErrors([fake('a-b'), fake('c1')])).toEqual([]);
  });

  it('catches a bad id', () => {
    expect(registryErrors([fake('Bad_Id')])).toEqual(['invalid id: Bad_Id']);
  });

  it('catches a duplicate id', () => {
    expect(registryErrors([fake('a'), fake('a')])).toEqual(['duplicate id: a']);
  });
});
