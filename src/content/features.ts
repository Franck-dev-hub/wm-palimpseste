import type { FeatureId } from '../shared/features';

export type Start = () => () => void;

export const starters: Record<FeatureId, Start> = {};
