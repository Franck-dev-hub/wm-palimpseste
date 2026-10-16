export interface Feature {
  id: string;
  nameKey: string;
  descriptionKey: string;
  default: boolean;
}

export const features = [
  {
    id: 'wikipedia',
    nameKey: 'wikipediaName',
    descriptionKey: 'wikipediaDescription',
    default: true,
  },
  {
    id: 'tag-highlight',
    nameKey: 'tagHighlightName',
    descriptionKey: 'tagHighlightDescription',
    default: true,
  },
] as const satisfies readonly Feature[];

export type FeatureId = (typeof features)[number]['id'];
