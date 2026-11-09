/** `@fougere/vite` — the one place a Vite-built host is told what a Fougere app needs. */
import { readdirSync, existsSync } from 'node:fs';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { join, resolve } from 'node:path';
import type { Plugin } from 'vite';
import { NodeRequest, sendNodeResponse } from 'srvx/node';
import { RUNTIME_PACKAGES } from '@fougere/core/node';
import { type Conventions, DEFAULT_CONVENTIONS } from '@fougere/core';
import { FACADE, frondAliases, projectRootOf } from '@fougere/core/node';

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
  /** Where the fronds are, when they sit elsewhere than `projectRootOf` finds. */
  root?: string;
  /** Set false when the host serves the call envelope itself. */
  serve?: boolean;
}

function serveDoors() {
  return (req: IncomingMessage, res: ServerResponse, next: () => void): void => {
    if (!(req.url ?? '').startsWith('/_fougere/')) return next();

    void (async () => {
      try {
        const web = await import('@fougere/app/web');
        await sendNodeResponse(res, await web.fougere(new NodeRequest({ req, res })));
      } catch (error) {
        res.statusCode = 500;
        res.setHeader('content-type', 'application/json');
        res.end(JSON.stringify({ code: 'INTERNAL_ERROR', message: (error as Error).message }));
      }
    })();
  };
}


async function writeDoors(root: string): Promise<void> {
  try {
    const { writeDerived } = await import('@fougere/compiler');
    await writeDerived(root);
  } catch (error) {
    console.warn(`[fougere] the scan failed, so @fronds/facade was not written: ${(error as Error).message}`);
  }
}

export function fougere(options: FougereViteOptions = {}): Plugin {
  const external = [...new Set([...RUNTIME_PACKAGES, ...(options.external ?? [])])];
  let app = process.cwd();
  const frondsOf = (from: string) => (options.root ? resolve(from, options.root) : projectRootOf(from));

  return {
    name: 'fougere',
    configureServer(server: { config?: { root?: string }; middlewares: { use(handler: ReturnType<typeof serveDoors>): void } }) {
      const root = server.config?.root ?? app;
      void writeDoors(frondsOf(root));
      if (options.serve !== false) server.middlewares.use(serveDoors());
    },
    async buildStart() {
      await writeDoors(frondsOf(app));
    },
    /** `order. */
    config: {
      order: 'post',
      async handler(config: Record<string, any>) {
        config.ssr ??= {};
        config.ssr.external = [...new Set([...(config.ssr.external ?? []), ...external])];

        app = resolve(config.root ?? app);
        process.env.FOUGERE_ROOT = frondsOf(app);
        config.resolve ??= {};
        config.resolve.tsconfigPaths ??= true;
        const fronds = await frondAliases(frondsOf(app));
        const facade = join(frondsOf(app), FACADE);
        config.resolve.alias = Array.isArray(config.resolve.alias)
          ? [...config.resolve.alias, { find: '@fronds/facade', replacement: facade }, ...Object.entries(fronds).map(([find, replacement]) => ({ find, replacement }))]
          : { ...config.resolve.alias, '@fronds/facade': facade, ...fronds };

        if (options.keepClassNames === false) return;

        const reserved = [...(options.reserved ?? []), ...entityNamesIn(frondsOf(app))];
        if (reserved.length === 0) return;

        config.build ??= {};
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
