/**
 * `withFougere(config)` — what Next has to be told so a Fougere app builds.
 *
 * ```ts
 * // next.config.ts
 * import { withFougere } from '@fougere/next/config';
 *
 * export default withFougere({ reactStrictMode: true });
 * ```
 *
 * The adapter owns the host's quirks. Nothing here leaks into the framework, and
 * nothing here asks the developer to write anything twice — a Next-specific
 * problem gets a Next-specific answer, in the Next package.
 *
 * Two things are set, both measured against a real production build:
 *
 * 1. **Class names survive minification.** Designation is class + verb, so
 *    `invoke(Post, 'list')` and `useQuery(Post, 'list')` read `Post.name`. Next's
 *    minifier renames it, and the call goes looking for an entity nobody hosts —
 *    `Entity 'j' is not hosted here. Hosted here: post`. Next's own knob
 *    (`noMangling`) is internal and all-or-nothing, so the minimizer is replaced by
 *    terser with `keep_classnames`, which keeps mangling everything else.
 *    Verified: the production browser chunk contains `class Post extends`.
 *
 * 2. **The scan's dependencies stay out of the bundle.** A boot reads frond
 *    sources off disk through jiti, so those packages must be loaded at runtime
 *    rather than compiled in.
 *
 * **Limit, stated rather than discovered later:** this rides Next's `webpack()`
 * hook, which Turbopack ignores. Next 16 builds with Turbopack by default, so an
 * app on 16 needs `next build --webpack` until Turbopack exposes a minifier option.
 * Next also documents its webpack config as outside semver.
 */
import TerserPlugin from 'terser-webpack-plugin';
import type { NextConfig } from 'next';

/** Packages a Fougere boot loads at runtime — they must not be bundled. */
const RUNTIME_PACKAGES = [
  '@fougere/app',
  '@fougere/core',
  '@fougere/next',
  '@fougere/schema-sql',
  'better-sqlite3',
  'jiti',
  'typescript',
];

export function withFougere(config: NextConfig = {}): NextConfig {
  const userWebpack = config.webpack;

  return {
    ...config,
    // Additive: whatever the app already listed is kept.
    serverExternalPackages: [
      ...new Set([...(config.serverExternalPackages ?? []), ...RUNTIME_PACKAGES]),
    ],
    webpack: (webpackConfig, context) => {
      // The app's own webpack function runs FIRST, so it sees an untouched config
      // and this never silently discards what it did.
      const base = userWebpack ? userWebpack(webpackConfig, context) : webpackConfig;

      base.optimization ??= {};
      // ONLY the JS minifier is replaced. Next's minimizers are plain functions with
      // no readable options, so they are told apart by their source: index 0 loads
      // `minify-webpack-plugin` (JS), index 1 loads `css-minimizer-plugin`. Replacing
      // the whole array — which this did at first — silently dropped CSS minification
      // and anything the app's own webpack function had added.
      const isJsMinifier = (m: unknown) => String(m).includes('minify-webpack-plugin');
      base.optimization.minimizer = [
        ...(base.optimization.minimizer ?? []).filter((m: unknown) => !isJsMinifier(m)),
        // `keep_fnames` is deliberately absent: designation reads a CLASS name and
        // nothing in this path reads a function name. Keeping every function name
        // costs bundle size for an invariant nothing has demonstrated.
        new TerserPlugin({ terserOptions: { keep_classnames: true } }),
      ];

      return base;
    },
  };
}
