const FEATURE_ID = /^[a-z0-9-]+$/;

const isOurs = (el: Element): boolean => el.closest('[data-wmpal]') !== null;

export const queryAll = (sel: string, root: ParentNode = document): Element[] =>
  [...root.querySelectorAll(sel)].filter((el) => !isOurs(el));

export const query = (sel: string, root: ParentNode = document): Element | null =>
  queryAll(sel, root)[0] ?? null;

export const assertFeatureId = (feature: string): void => {
  if (!FEATURE_ID.test(feature)) throw new Error(`Invalid feature id: "${feature}"`);
};

export const mark = (node: Element, feature: string): void => {
  assertFeatureId(feature);
  node.setAttribute('data-wmpal', feature);
};
