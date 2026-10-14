/**
 * Is this deployment read-only?
 *
 * A generated site has no server behind it: reads were realized at build time by the Frond,
 * and writes have nowhere to go. Derived from the build, never configured — `nuxt generate`
 * writes it into the public config, which every page carries, the SPA fallback included, so a
 * URL typed by hand on Pages knows it too.
 */
export function useReadOnlyDeployment() {
  return computed(() => useRuntimeConfig().public.readOnly === true);
}
