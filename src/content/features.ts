import type { FeatureId } from '../shared/features';
import { startTagHighlight } from './tag-highlight';
import { startTagMenu } from './tag-menu';
import { startTagProposal } from './tag-proposal';
import { startWikipedia } from './wikipedia';

export type Start = () => () => void;

export const starters: Record<FeatureId, Start> = {
  wikipedia: startWikipedia,
  'tag-highlight': startTagHighlight,
  'tag-proposal': startTagProposal,
  'tag-menu': startTagMenu,
};
