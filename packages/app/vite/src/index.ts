/** `@fougere/vite` — the one place a Vite-built host is told what a Fougere app needs. */
import { readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import type { Plugin } from 'vite';
import { type Conventions, DEFAULT_CONVENTIONS, RUNTIME_PACKAGES } from '@fougere/core/node';

/** The entity names a build must not rename, read off the filesystem. */
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
  /** Set false to keep the host's own minifier. */
  keepClassNames?: boolean;
  /** Extra identifiers to reserve, for entities that do not live under `fronds/`. */
  reserved?: string[];
}

export function fougere(options: FougereViteOptions = {}): Plugin {
  const external = [...new Set([...RUNTIME_PACKAGES, ...(options.external ?? [])])];

  return {
    name: 'fougere',
    /** `order. */
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
