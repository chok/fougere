/**
 * `@fougere/vite` — the one place a Vite-built host is told what a Fougere app needs.
 *
 * ```ts
 * // vite.config.ts
 * import { fougere } from '@fougere/vite';
 *
 * export default defineConfig({ plugins: [fougere(), sveltekit()] });
 * ```
 *
 * One plugin, three hosts: TanStack Start, React Router and SvelteKit all build with
 * Vite, so none of them needs a package of its own. That was the hole in the first
 * version of this fix — it lived in `@fougere/next`, and the three hosts that have
 * no adapter package had nowhere to put it.
 *
 * ## What it states, and why each one
 *
 * **1. A minifier that keeps class names — necessary here, and NOT sufficient.**
 * Designation is class + verb, so `useQuery(Post, 'list')` reads `Post.name`.
 *
 * Measured, and the measurement is the point: with `minify: 'terser'` and
 * `keep_classnames` resolved (verified through `configResolved` on all three
 * builds), a named class DOES survive — `class FougereError extends` is in the
 * output — but an entity does not: it ships as `Ot=class extends…`. Rollup emits
 * `export default class Post extends entity({…})` as an assignment to a variable,
 * so the name is already gone by the time terser runs, and terser cannot keep a
 * name that no longer exists. Making it a named export changes nothing (measured).
 *
 * So on a Rollup-based host this setting is correct and insufficient, and a
 * production build there still designates an entity nobody hosts. Webpack keeps the
 * name, which is why `@fougere/next` is fixed and these are not. What that shows is
 * that the rule is not a host's to enforce: an identity that only survives when the
 * compiler feels like it is not an identity. The durable answer is for an entity to
 * carry its registration name as data — a decision about designation, deliberately
 * not taken here.
 *
 * **2. The scan's dependencies stay out of the server bundle.** A boot reads frond
 * sources off disk through jiti, so those packages are loaded at runtime instead.
 * The three demos each copied this list into their own config; it belongs here.
 *
 * The rule this encodes is not "Vite is special", it is: **any bundler that carries
 * a Fougere entity class must preserve its name.**
 */
import type { Plugin } from 'vite';

/** Packages a Fougere boot loads at runtime — they must not be bundled. */
export const RUNTIME_PACKAGES = [
  '@fougere/app',
  '@fougere/core',
  '@fougere/schema',
  '@fougere/schema-sql',
  '@fougere/schema-graphql',
  '@fougere/auth-better',
  'better-sqlite3',
  'jiti',
  'typescript',
];

export interface FougereViteOptions {
  /** Extra packages the boot loads at runtime, added to the defaults. */
  external?: string[];
  /**
   * Set false to keep the host's own minifier. Only do this if something else in
   * the build already preserves class names — otherwise production designates a
   * renamed class and the call is refused.
   */
  keepClassNames?: boolean;
}

export function fougere(options: FougereViteOptions = {}): Plugin {
  const external = [...new Set([...RUNTIME_PACKAGES, ...(options.external ?? [])])];

  return {
    name: 'fougere',
    /**
     * `order: 'post'` and a MUTATION, not a returned patch — and both halves were
     * measured.
     *
     * Returning `{ build: { minify: 'terser' } }` is the idiomatic form, and it did
     * not work: Vite deep-merges those patches, and the framework plugins
     * (`tanstackStart()`, `reactRouter()`, `sveltekit()`) set their own `build`
     * afterwards, so all three demos still shipped `C=class extends…`. Running last
     * and writing the value directly is what makes the setting hold whatever the
     * host declares.
     *
     * The app keeps the last word anyway: `keepClassNames: false` turns this off.
     */
    config: {
      order: 'post',
      handler(config: Record<string, any>) {
        config.ssr ??= {};
        config.ssr.external = [...new Set([...(config.ssr.external ?? []), ...external])];

        if (options.keepClassNames === false) return;

        config.build ??= {};
        // Vite's default minifier is esbuild, which has no per-name option; terser does.
        config.build.minify = 'terser';
        config.build.terserOptions = {
          ...config.build.terserOptions,
          keep_classnames: true,
        };
      },
    },
  };
}
