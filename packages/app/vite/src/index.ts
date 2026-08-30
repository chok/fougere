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
 * **1. The entity's name survives minification.** Designation is class + verb, so
 * `useQuery(Post, 'list')` reads `Post.name`, and that name travels — it is the
 * JSON-RPC method (`post.list`) and the REST path.
 *
 * Getting there took measuring what actually happens, because the obvious setting
 * is not enough. Rollup cannot keep `class Post extends entity({…})` as a hoisted
 * declaration — its heritage clause is a CALL — so it emits `var Post = class
 * extends entity({…})`. The class is ANONYMOUS; `Post.name` works only through
 * JavaScript's name inference from the variable. So `keep_classnames` protects
 * nothing (there is no class name to keep), in `compress` or in `mangle` — both
 * measured, both `Ot`.
 *
 * What works is reserving the IDENTIFIER: `mangle.reserved`. The variable keeps its
 * name, inference keeps working, and everything else is still mangled. Measured:
 * `var Post=class extends…` in the production client bundle.
 *
 * And the list is not config — `entityNamesIn` reads it from `fronds/<frond>/entities/`,
 * the same convention the scan already uses. The developer writes nothing.
 *
 * **2. The scan's dependencies stay out of the server bundle.** A boot reads frond
 * sources off disk through jiti, so those packages are loaded at runtime instead.
 * The three demos each copied this list into their own config; it belongs here.
 *
 * The rule this encodes is not "Vite is special", it is: **any bundler that carries
 * a Fougere entity class must preserve its name.**
 */
import { readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import type { Plugin } from 'vite';
import { type Conventions, DEFAULT_CONVENTIONS, RUNTIME_PACKAGES } from '@fougere/core/node';

/**
 * The entity names a build must not rename, read off the filesystem.
 *
 * `fronds/blog/entities/Post.ts` IS the declaration of an entity called `Post` —
 * the scan already treats the file name that way. So the list needs no config and
 * no annotation: it is derived from the same convention the framework already
 * relies on, which is why this feint costs the developer nothing.
 */
export function entityNamesIn(root: string, conventions: Conventions = DEFAULT_CONVENTIONS): string[] {
  const frondsDir = join(root, conventions.fronds);
  if (!existsSync(frondsDir)) return [];

  const names = new Set<string>();
  for (const frond of readdirSync(frondsDir, { withFileTypes: true })) {
    if (!frond.isDirectory()) continue;
    const entities = join(frondsDir, frond.name, conventions.dirs.entities);
    if (!existsSync(entities)) continue;
    for (const file of readdirSync(entities)) {
      const match = /^(.+)\.tsx?$/.exec(file);
      if (match) names.add(match[1]!);
    }
  }
  return [...names];
}

export { RUNTIME_PACKAGES } from '@fougere/core/node';

export interface FougereViteOptions {
  /** Extra packages the boot loads at runtime, added to the defaults. */
  external?: string[];
  /**
   * Set false to keep the host's own minifier. Only do this if something else in
   * the build already preserves class names — otherwise production designates a
   * renamed class and the call is refused.
   */
  keepClassNames?: boolean;
  /** Extra identifiers to reserve, for entities that do not live under `fronds/`. */
  reserved?: string[];
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

        const reserved = [...(options.reserved ?? []), ...entityNamesIn(config.root ?? process.cwd())];
        if (reserved.length === 0) return;

        config.build ??= {};
        // Vite's default minifier is esbuild, which has no per-name option; terser does.
        config.build.minify = 'terser';
        config.build.terserOptions = {
          ...config.build.terserOptions,
          keep_classnames: true,
          mangle: {
            ...config.build.terserOptions?.mangle,
            reserved: [...new Set([...(config.build.terserOptions?.mangle?.reserved ?? []), ...reserved])],
          },
        };
      },
    },
  };
}
