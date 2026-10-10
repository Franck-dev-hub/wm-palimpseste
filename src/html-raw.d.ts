// Vite resolves `?raw` imports in tests; this only types them.
declare module '*.html?raw' {
  const content: string;
  export default content;
}
