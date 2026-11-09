/** `withFougere(config)` — what Next has to be told so a Fougere app builds. */
import { existsSync, readdirSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import TerserPlugin from 'terser-webpack-plugin';
import type { NextConfig } from 'next';

import { resolveConventions } from '@fougere/core';
import { FACADE, frondNamesOf, projectRootOf, REMOTES, RUNTIME_PACKAGES } from '@fougere/core/node';

const SPECIFIER = '@fronds/facade';
async function writeFacades(root: string): Promise<void> {
  try {
    const { writeDerived } = await import('@fougere/compiler');
    await writeDerived(root);
  } catch (error) {
    console.warn(`[fougere] the scan failed, so @fronds/facade was not written: ${(error as Error).message}`);
  }
}

const PRODUCTION_SERVER = 'phase-production-server';

export function withFougere(config: NextConfig = {}, options: { root?: string } = {}): (phase: string) => NextConfig {
  return (phase) => {
    const app = process.cwd();
    const root = options.root ? resolve(app, options.root) : projectRootOf(app);
    process.env.FOUGERE_ROOT = root;
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
    serverExternalPackages: [
      ...new Set([...(config.serverExternalPackages ?? []), ...RUNTIME_PACKAGES, '@fougere/next']),
    ],
    turbopack: {
      ...config.turbopack,
      resolveAlias: {
        ...config.turbopack?.resolveAlias,
        [SPECIFIER]: `./${relative(app, join(root, FACADE))}`,
        [`${scope}/*.js`]: `./${relative(app, local)}/*.ts`,
        ...Object.fromEntries(elsewhere.map(([name, dir]) => [`${scope}/${name}/*.js`, `./${relative(app, dir)}/*.ts`])),
      },
    },
    webpack: (webpackConfig, context) => {
      const base = userWebpack ? userWebpack(webpackConfig, context) : webpackConfig;

      base.resolve ??= {};
      base.resolve.alias = {
        [SPECIFIER]: join(root, FACADE),
        ...base.resolve.alias,
        ...Object.fromEntries(elsewhere.map(([name, dir]) => [`${scope}/${name}`, dir])),
        [scope]: local,
      };
      base.resolve.extensionAlias = { ...base.resolve.extensionAlias, '.js': ['.js', '.ts', '.tsx'] };

      base.optimization ??= {};
      const isJsMinifier = (m: unknown) => String(m).includes('minify-webpack-plugin');
      base.optimization.minimizer = [
        ...(base.optimization.minimizer ?? []).filter((m: unknown) => !isJsMinifier(m)),
        new TerserPlugin({ terserOptions: { keep_classnames: true } }),
      ];

      return base;
    },
  };
}

function frondsElsewhere(root: string, local: string): [string, string][] {
  const remotes = join(root, REMOTES);
  const synced = (existsSync(remotes) ? readdirSync(remotes, { withFileTypes: true }) : [])
    .filter((entry) => entry.isDirectory() && !existsSync(join(local, entry.name)))
    .map((entry): [string, string] => [entry.name, join(remotes, entry.name)]);
  const renamed = [...frondNamesOf(root)].map(([directory, name]): [string, string] => [name, join(local, directory)]);

  return [...synced, ...renamed];
}
