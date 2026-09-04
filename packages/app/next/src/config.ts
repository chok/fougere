/** `withFougere(config)` — what Next has to be told so a Fougere app builds. */
import TerserPlugin from 'terser-webpack-plugin';
import type { NextConfig } from 'next';

import { RUNTIME_PACKAGES } from '@fougere/core/node';

export function withFougere(config: NextConfig = {}): NextConfig {
  const userWebpack = config.webpack;

  return {
    ...config,
    // Additive: whatever the app already listed is kept.
    serverExternalPackages: [
      // `@fougere/next` is this plugin's own package: it externalizes itself, which is a
      // fact about Next and not about a Fougere boot, so it is added here and not to the list.
      ...new Set([...(config.serverExternalPackages ?? []), ...RUNTIME_PACKAGES, '@fougere/next']),
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
