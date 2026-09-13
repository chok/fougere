/** `withFougere(config)` — what Next has to be told so a Fougere app builds. */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import TerserPlugin from 'terser-webpack-plugin';
import type { NextConfig } from 'next';

import { RUNTIME_PACKAGES } from '@fougere/compiler';

/** Where the facades land, and what a page imports them by. */
const FACADE = '.fougere/facade.generated.ts';
const SPECIFIER = '@fronds/facade';

/**
 * The facades this app serves, written when the config is read.
 *
 * Synchronously and not in a hook: a Next config is evaluated before anything resolves a
 * module, and the alias below points at a file a page imports. The scan LOADS a frond's own
 * sources, so a TS-aware loader is installed first — without it `scanProject` throws and the
 * module is silently never written.
 */
async function writeFacades(root: string): Promise<void> {
  try {
    const { scanProject, emitFacade, frondAliases } = await import('@fougere/compiler');
    const { setModuleLoader } = await import('@fougere/core/node');
    const { resolveConventions } = await import('@fougere/core');
    const { createJiti } = await import('jiti');

    const jiti = createJiti(import.meta.url, {
      interopDefault: true,
      alias: await frondAliases(root, resolveConventions()),
    });
    setModuleLoader((filePath: string) => jiti.import(filePath) as Promise<Record<string, unknown>>);

    const out = join(root, FACADE);
    mkdirSync(dirname(out), { recursive: true });
    writeFileSync(out, emitFacade(await scanProject(root), { outFile: out }));
  } catch { /* a host with no fronds, or a scan that could not run */ }
}

export function withFougere(config: NextConfig = {}): NextConfig {
  const userWebpack = config.webpack;
  const root = process.cwd();
  const written = writeFacades(root);

  return {
    ...config,
    // Additive: whatever the app already listed is kept.
    serverExternalPackages: [
      // `@fougere/next` is this plugin's own package: it externalizes itself, which is a
      // fact about Next and not about a Fougere boot, so it is added here and not to the list.
      ...new Set([...(config.serverExternalPackages ?? []), ...RUNTIME_PACKAGES, '@fougere/next']),
    ],
    // A page IMPORTS its facade, so the alias sits beside the file `writeFacades` writes: a
    // project that never generated it fails to resolve rather than losing its types in silence.
    turbopack: {
      ...config.turbopack,
      resolveAlias: { ...config.turbopack?.resolveAlias, [SPECIFIER]: join(root, FACADE) },
    },
    webpack: (webpackConfig, context) => {
      // The app's own webpack function runs FIRST, so it sees an untouched config
      // and this never silently discards what it did.
      const base = userWebpack ? userWebpack(webpackConfig, context) : webpackConfig;

      void written;
      base.resolve ??= {};
      base.resolve.alias = { ...base.resolve.alias, [SPECIFIER]: join(root, FACADE) };

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
