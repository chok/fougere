/** `withFougere(config)` — what Next has to be told so a Fougere app builds. */
import { existsSync, readdirSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import TerserPlugin from 'terser-webpack-plugin';
import type { NextConfig } from 'next';

import { resolveConventions } from '@fougere/core';
import { FACADE, frondNamesOf, projectRootOf, REMOTES, RUNTIME_PACKAGES } from '@fougere/core/node';

/** What a page imports its facades by. */
const SPECIFIER = '@fronds/facade';
/**
 * The facades this app serves, written when the config is read.
 *
 * Synchronously and not in a hook: a Next config is evaluated before anything resolves a
 * module, and the alias below points at a file a page imports.
 */
async function writeFacades(root: string): Promise<void> {
  try {
    const { writeDerived } = await import('@fougere/compiler');
    await writeDerived(root);
  } catch (error) {
    console.warn(`[fougere] the scan failed, so @fronds/facade was not written: ${(error as Error).message}`);
  }
}

/**
 * The fronds are found on their own (`projectRootOf`) — `root` is for when they sit elsewhere, the
 * same option `fougere()` takes for Vite and `fougere:` for Nuxt. The facade is written at the root
 * beside the statement, and the boot learns the root through `FOUGERE_ROOT`.
 */
/** The phase a production server starts in — it serves what its build wrote, and writes nothing. */
const PRODUCTION_SERVER = 'phase-production-server';

export function withFougere(config: NextConfig = {}, options: { root?: string } = {}): (phase: string) => NextConfig {
  return (phase) => {
    const app = process.cwd();
    const root = options.root ? resolve(app, options.root) : projectRootOf(app);
    process.env.FOUGERE_ROOT = root;
    // Writing scans, and a scan loads TypeScript: `next start` evaluates this file too.
    if (phase !== PRODUCTION_SERVER) void writeFacades(root);

    return nextConfigOf(config, { root, app });
  };
}

/** The Next config Fougere adds to the app's own — what `withFougere` hands Next once it has written. */
export function nextConfigOf(config: NextConfig, { root, app }: { root: string; app: string }): NextConfig {
  const userWebpack = config.webpack;
  const conventions = resolveConventions();
  const scope = conventions.scope;
  const local = join(root, conventions.fronds);
  const elsewhere = frondsElsewhere(root, local);

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
      // Relative to the app: Turbopack refuses an absolute target — "server relative imports are
      // not implemented yet" — where webpack, below, wants one.
      // `paths` reaches Turbopack, but a `.js` request through it never finds the `.ts` beside it.
      resolveAlias: {
        ...config.turbopack?.resolveAlias,
        [SPECIFIER]: `./${relative(app, join(root, FACADE))}`,
        [`${scope}/*.js`]: `./${relative(app, local)}/*.ts`,
        ...Object.fromEntries(elsewhere.map(([name, dir]) => [`${scope}/${name}/*.js`, `./${relative(app, dir)}/*.ts`])),
      },
    },
    webpack: (webpackConfig, context) => {
      // The app's own webpack function runs FIRST, so it sees an untouched config
      // and this never silently discards what it did.
      const base = userWebpack ? userWebpack(webpackConfig, context) : webpackConfig;

      base.resolve ??= {};
      // `@fronds/*` as the tsconfig maps it, but as an alias: Next applies `paths` through a plugin
      // `extensionAlias` never reaches, so `@fronds/blog/entities/Post.js` found no `.ts` there.
      // The facade first — it is the one specifier under `@fronds` that names no directory.
      base.resolve.alias = {
        [SPECIFIER]: join(root, FACADE),
        ...base.resolve.alias,
        ...Object.fromEntries(elsewhere.map(([name, dir]) => [`${scope}/${name}`, dir])),
        [scope]: local,
      };
      // A frond is ESM TypeScript, so one entity imports another as `./Author.js` and the file is `.ts`.
      // `.js` is tried first: a frond package's `exports` may map `./entities/*.js` itself, and a
      // request rewritten to `.ts` before reaching them matches none of its keys.
      base.resolve.extensionAlias = { ...base.resolve.extensionAlias, '.js': ['.js', '.ts', '.tsx'] };

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

/**
 * The fronds the convention would not find under `fronds/<name>` — the ones `fougere sync` wrote, and the
 * ones the project's `tsconfig.json` renames — as name and directory. A bundler alias names one directory.
 */
function frondsElsewhere(root: string, local: string): [string, string][] {
  const remotes = join(root, REMOTES);
  const synced = (existsSync(remotes) ? readdirSync(remotes, { withFileTypes: true }) : [])
    .filter((entry) => entry.isDirectory() && !existsSync(join(local, entry.name)))
    .map((entry): [string, string] => [entry.name, join(remotes, entry.name)]);
  const renamed = [...frondNamesOf(root)].map(([directory, name]): [string, string] => [name, join(local, directory)]);

  return [...synced, ...renamed];
}
