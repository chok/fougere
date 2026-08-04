/**
 * Is this deployment read-only?
 *
 * A prerendered site has no server behind it: reads were realized at build time
 * by the Frond, writes have nowhere to go. Derived from the build, never
 * configured — `nuxt build` leaves it false, `nuxt generate` bakes it true into
 * the payload, so the client hydrates on the same answer the server rendered.
 *
 * It hides the affordances that lead to a write. It does not remove the routes:
 * the SPA fallback renders any URL client-side, so /login typed by hand still
 * draws its form — it just has no submit target. No path through the site
 * reaches it.
 */
export function useReadOnlyDeployment() {
  return useState('read-only-deployment', () => import.meta.prerender === true);
}
