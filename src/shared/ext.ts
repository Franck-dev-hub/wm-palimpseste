// Chrome 111 has no `browser`, though @types/chrome declares it.
export const ext = globalThis.browser ?? chrome;
