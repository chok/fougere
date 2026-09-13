/** `@fougere/vite` — the one place a Vite-built host is told what a Fougere app needs. */
import { readdirSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import type { Plugin } from 'vite';
import { RUNTIME_PACKAGES } from '@fougere/compiler';
import { type Conventions, DEFAULT_CONVENTIONS } from '@fougere/core';

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

export { RUNTIME_PACKAGES } from '@fougere/compiler';

export interface FougereViteOptions {
  /** Extra packages the boot loads at runtime, added to the defaults. */
  external?: string[];
  /** Set false to keep the host's own minifier. */
  keepClassNames?: boolean;
  /** Extra identifiers to reserve, for entities that do not live under `fronds/`. */
  reserved?: string[];
}

/**
 * Where the door types land — the same place `fougere build` puts them, so a host that runs the
 * command and one that only starts a dev server read one file and not two.
 */
const DOORS = '.fougere/doors.generated.d.ts';

/**
 * The doors this app serves, as TYPES, written when the dev server comes up.
 *
 * TypeScript records nothing about what a function throws, so a client cannot know which
 * refusals one door answers without being told. Nuxt writes its own beside the two modules it
 * already generates; every other host reaches this plugin, which is what makes the narrowing
 * something you get from starting the app rather than from remembering a command.
 *
 * A scan that fails is not a failure of the dev server: the types fall back to every code there
 * is, which is what a client had before this existed.
 */
async function writeDoors(root: string): Promise<void> {
  try {
    const { scanProject, emitDoors } = await import('@fougere/compiler');
    const out = join(root, DOORS);
    mkdirSync(dirname(out), { recursive: true });
    writeFileSync(out, emitDoors(await scanProject(root)));
  } catch { /* a host with no fronds, or a scan that could not run */ }
}

export function fougere(options: FougereViteOptions = {}): Plugin {
  const external = [...new Set([...RUNTIME_PACKAGES, ...(options.external ?? [])])];

  return {
    name: 'fougere',
    configureServer(server: { config?: { root?: string } }) {
      void writeDoors(server.config?.root ?? process.cwd());
    },
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
