export interface Feature {
  id: string;
  nameKey: string;
  descriptionKey: string;
  default: boolean;
}

export const features = [] as const satisfies readonly Feature[];

export type FeatureId = (typeof features)[number]['id'];
