/** `@fougere/vite` — the one place a Vite-built host is told what a Fougere app needs. */
import type { FougereConfig } from '@fougere/core';
import { readdirSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { join, dirname, resolve } from 'node:path';
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
  /**
   * Where the fronds are, from the app — `'../..'` in a workspace, whose `fronds/` sit at its
   * root. The same key `@fougere/nuxt` reads.
   */
  root?: string;
  /** Set false when the host serves the call envelope itself. */
  serve?: boolean;
}

/** What the browser primitives call, and the web handler that answers each. */
const DOORS = { '/_fougere/call': 'call', '/_fougere/session': 'session' } as const;

/**
 * The call envelope, answered by the dev server itself: a Vite app has no server of its own, and
 * the browser calls its own origin. The app boots at the first call, from `fougere.config.ts`, so
 * `fronds:` decides whether a frond answers here or a process away — the same line as under Nuxt.
 */
function serveDoors() {
  return (req: IncomingMessage, res: ServerResponse, next: () => void): void => {
    const path = (req.url ?? '').split('?')[0] as keyof typeof DOORS;
    const door = DOORS[path];
    if (!door) return next();

    void (async () => {
      try {
        const web = await import('@fougere/app/web');
        const response = await web[door](await requestOf(req));
        res.statusCode = response.status;
        response.headers.forEach((value, key) => res.setHeader(key, value));
        res.end(Buffer.from(await response.arrayBuffer()));
      } catch (error) {
        res.statusCode = 500;
        res.setHeader('content-type', 'application/json');
        res.end(JSON.stringify({ code: 'INTERNAL_ERROR', message: (error as Error).message }));
      }
    })();
  };
}

async function requestOf(req: IncomingMessage): Promise<Request> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) chunks.push(chunk as Buffer);
  const headers = new Headers(Object.entries(req.headers)
    .filter((entry): entry is [string, string] => typeof entry[1] === 'string'));

  return new Request(`http://${req.headers.host ?? 'localhost'}${req.url}`, {
    method: req.method,
    headers,
    ...(chunks.length ? { body: Buffer.concat(chunks) } : {}),
  });
}

/**
 * Where the facade types land — the same place `fougere build` puts them, so a host that runs the
 * command and one that only starts a dev server read one file and not two.
 */
const FACADE = '.fougere/facade.generated.ts';
const NAMES = '.fougere/names.generated.d.ts';

/**
 * The facades this app serves, written when the dev server comes up — one export per address,
 * carrying the handler that answers there as a type.
 *
 * TypeScript records nothing about what a function throws, so a client cannot know which
 * refusals one operation answers without being told. Nuxt writes its own beside the two modules it
 * already generates; every other host reaches this plugin, which is what makes the narrowing
 * something you get from starting the app rather than from remembering a command.
 *
 * A scan that fails is not a failure of the dev server: the types fall back to every code there
 * is, which is what a client had before this existed.
 */
async function writeDoors(app: string, root: string): Promise<void> {
  try {
    const { scanProject, emitFacade, emitNames, frondAliases } = await import('@fougere/compiler');
    const { setModuleLoader } = await import('@fougere/core/node');
    const { resolveConventions } = await import('@fougere/core');
    const { createJiti } = await import('jiti');

    // The scan LOADS a frond's own sources, and `@fronds/user/entities/User.js` inside a handler
    // has to resolve there for the same reason it does in a page. Without it `scanProject`
    // throws `Cannot find module …/Post.js`, the catch below swallows it, and the module is
    // silently never written — which is what happened until this line existed.
    const jiti = createJiti(import.meta.url, {
      interopDefault: true,
      alias: await frondAliases(root, resolveConventions()),
    });
    setModuleLoader((filePath: string) => jiti.import(filePath) as Promise<Record<string, unknown>>);
    const { loadConfig } = await import('@fougere/core/node');
    const out = join(app, FACADE);
    mkdirSync(dirname(out), { recursive: true });
    const scan = await scanProject(root);
    writeFileSync(out, emitFacade(scan, { outFile: out }));
    // What a config may NAME, from the same scan: the sources are the config's own keys, which
    // no scan can find, and a project without one states none.
    const config = await loadConfig(root).catch(() => ({}) as FougereConfig);
    writeFileSync(join(app, NAMES), emitNames(scan, { sources: Object.keys(config.sources ?? {}) }));
  } catch { /* a host with no fronds, or a scan that could not run */ }
}

export function fougere(options: FougereViteOptions = {}): Plugin {
  const external = [...new Set([...RUNTIME_PACKAGES, ...(options.external ?? [])])];
  // Where `config` said the app is, so `buildStart` writes beside the alias it set — and where
  // its fronds are, which a workspace puts two levels up.
  let app = process.cwd();
  const frondsOf = (from: string) => resolve(from, options.root ?? '.');

  return {
    name: 'fougere',
    configureServer(server: { config?: { root?: string }; middlewares: { use(handler: ReturnType<typeof serveDoors>): void } }) {
      const root = server.config?.root ?? app;
      void writeDoors(root, frondsOf(root));
      if (options.serve !== false) server.middlewares.use(serveDoors());
    },
    /**
     * AWAITED, and that is the whole point: the bundler resolves `@fronds/facade` right after
     * this hook, and a fire-and-forget write loses the race — `Could not load
     * .fougere/facade.generated.ts`, measured on `demos/react-router-blog`.
     */
    async buildStart() {
      await writeDoors(app, frondsOf(app));
    },
    /** `order. */
    config: {
      order: 'post',
      handler(config: Record<string, any>) {
        config.ssr ??= {};
        config.ssr.external = [...new Set([...(config.ssr.external ?? []), ...external])];

        // A page IMPORTS its facade, so the alias sits beside the file that declares them: a
        // project that never generated it fails to resolve rather than losing its types in
        // silence.
        app = resolve(config.root ?? app);
        // Read by the boot, which runs in this process and has no other way to learn it — the
        // variable `@fougere/nuxt` sets for the same reason.
        process.env.FOUGERE_ROOT = frondsOf(app);
        config.resolve ??= {};
        // Vite admits BOTH shapes and a host picks one: SvelteKit states an array of
        // `{ find, replacement }`, and spreading an object over it made rolldown refuse the
        // whole plugin — `StringExpected … on BindingViteAliasPluginAlias.replacement`.
        const facade = join(app, FACADE);
        config.resolve.alias = Array.isArray(config.resolve.alias)
          ? [...config.resolve.alias, { find: '@fronds/facade', replacement: facade }]
          : { ...config.resolve.alias, '@fronds/facade': facade };

        if (options.keepClassNames === false) return;

        const reserved = [...(options.reserved ?? []), ...entityNamesIn(frondsOf(app))];
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
