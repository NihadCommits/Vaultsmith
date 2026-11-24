declare module "virtual:starter" {
  /** Starter config, templates and Worklist.base from src/starter, keyed by relative path. */
  const files: Record<string, string>;
  export default files;
}
