/**
 * @fougere/nuxt — Nuxt module: scans fronds, registers the four
 * primitives (useQuery/useCommand, useFormFor, useCurrentUser) and the
 * server surface (call envelope, session, REST bridge, auth).
 */
import {
  defineNuxtModule,
  addServerHandler,
  addServerImportsDir,
  addServerPlugin,
  addPlugin,
  addTemplate,
  addImports,
  createResolver,
  useLogger,
} from '@nuxt/kit';
import type { Nuxt } from '@nuxt/schema';
import { orderSeeds } from '@fougere/core';
import {
  scanProject, emitScan, frondAliases, frondPackage, watchPathsOf, resolveConventions, type Conventions,
  setModuleLoader, loadCascadedConfig,
} from '@fougere/core/node';
import { declaresStorage } from '@fougere/defaults';
import type { SeedEntry, FougereConfig } from '@fougere/core';
import { createJiti } from 'jiti';
import { resolve, relative } from 'node:path';
import { existsSync, readFileSync, readdirSync } from 'node:fs';

export interface FougereModuleOptions {
  /** Override fougere.config.ts values from nuxt.config. Optional. */
  db?: FougereConfig['db'];
  /**
   * Where `fronds/` lives, relative to the app's rootDir. Default: the app
   * itself. Set to `../..` for an app under `apps/*` in a workspace whose
   * fronds are shared at the root. Config and `.fougere` stay app-local.
   */
  root?: string;
}


/**
 * A frond directory as the pattern Nuxt tests for a restart: it matches the changed
 * file against the path relative to the layer's app dir, so that is the base here.
 */
const restartsOnFrom = (srcDir: string) => (dir: string): RegExp =>
  new RegExp(`^${relative(srcDir, dir).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}[\\\\/]`);

const module = defineNuxtModule<FougereModuleOptions>({
  meta: {
    name: '@fougere/nuxt',
    configKey: 'fougere',
  },

  async setup(options: FougereModuleOptions, nuxt: Nuxt) {
    const { resolve: resolveModule } = createResolver(import.meta.url);
    const runtimeResolve = (...path: string[]) =>
      resolveModule('../src/runtime', ...path);
    const rootDir = nuxt.options.rootDir;
    // Fronds may live at the workspace root (app under apps/*); config/.fougere stay app-local.
    const scanRoot = options.root ? resolve(rootDir, options.root) : rootDir;
    // The runtime app (fougereApp) scans fronds too; hand it the same root via
    // env (the Nitro dev worker inherits the parent env, like FORCE_COLOR above).
    process.env.FOUGERE_ROOT = scanRoot;

    // Propagate color support to Nitro dev worker (inherits parent env but has no TTY)
    if (process.stdout?.isTTY && !process.env.NO_COLOR) {
      process.env.FORCE_COLOR ??= '1';
    }

    // Prevent Nitro from bundling the TypeScript compiler (~9 MB).
    // @fougere/core lazy-imports it, but Rollup still code-splits dynamic imports
    // into the bundle — only external truly excludes it.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (nuxt as any).hook('nitro:config', (nitroConfig: any) => {
      nitroConfig.rollupConfig ??= {};
      nitroConfig.rollupConfig.external ??= [];
      if (Array.isArray(nitroConfig.rollupConfig.external)) {
        nitroConfig.rollupConfig.external.push('typescript');
      }
      // invoke reads the current request (state) through nitro's async context
      nitroConfig.experimental = { ...nitroConfig.experimental, asyncContext: true };
    });

    // ── 0. A TS-aware loader, installed twice on purpose ──
    // The Vite alias below covers `.vue` pages; this covers the SCAN, which loads a
    // frond's own sources — so `@fronds/user/entities/User.js` inside a handler resolves
    // for the same reason it does in a page.
    //
    // The FIRST install carries no aliases, because the config names the scope they are
    // built from: reading it must not need them. Safe because nothing in
    // `fougere.config.ts` may import `@fronds/*` — the one import that would need the
    // name to read the file that declares it.
    const installLoader = (alias?: Record<string, string>): void => {
      const jiti = createJiti(import.meta.url, { interopDefault: true, ...(alias ? { alias } : {}) });
      setModuleLoader((filePath) => jiti.import(filePath) as Promise<Record<string, unknown>>);
    };
    installLoader();

    // ── 0b. Load fougere.config.ts along the workspace→app cascade (scanRoot is
    //        the workspace when the app declares `root`); module options override. ──
    const fileConfig = await loadCascadedConfig(scanRoot, rootDir);
    const optionsOverride = Object.fromEntries(
      Object.entries(options).filter(([, v]) => v !== undefined),
    ) as Partial<FougereConfig>;
    const config: FougereConfig = { db: 'sqlite', ...fileConfig, ...optionsOverride };
    const conventions = resolveConventions(config.conventions);

    // Now the names are known, so the loader can resolve them — and the scan below runs
    // with them installed, which is what lets it read a frond that names its neighbour.
    installLoader(await frondAliases(scanRoot, conventions));

    // ── 1. Scan fronds (filtered by FOUGERE_FRONDS env var) ──
    const frondsFilter = process.env.FOUGERE_FRONDS?.split(',').map((s) => s.trim()).filter(Boolean);
    const scan = await scanProject(scanRoot, frondsFilter, conventions);
    const { fronds } = scan;

    // ── 1b. Register @fronds/* aliases for all fronds, and watch them ──
    // The scanned fronds ARE the watch list — nothing to declare. Without this, a
    // frond under `apps/../..` sits outside rootDir, so Nuxt never restarts: the scan,
    // the additive migration (once per boot) and the seeds all keep the previous shape,
    // and a field you just added is simply absent with no error anywhere.
    for (const frond of fronds) {
      nuxt.options.alias[frond.source.package] = frond.source.path;
      const watched = watchPathsOf(frond, scanRoot, conventions);
      // Nuxt reads this list TWICE and a directory serves only the first read: the
      // watcher adds string entries, while the restart test is `pattern === path`
      // against the changed FILE — which a directory never equals. So each dir goes
      // in twice, as itself and as the pattern that matches what lives under it.
      nuxt.options.watch.push(...watched, ...watched.map(restartsOnFrom(nuxt.options.srcDir)));
    }

    // ── 1b-bis. Keep entity names through minification ──────────────────────
    //
    // Designation is class + verb: `useQuery(Post, 'list')` reads `Post.name`, and
    // that name travels — it is the JSON-RPC method (`post.list`) and the REST path.
    //
    // Rollup cannot keep `class Post extends entity({…})` as a hoisted declaration
    // (its heritage clause is a CALL), so it emits `var Post = class extends …`.
    // The class is ANONYMOUS; the name comes from JavaScript's inference on the
    // variable. `keep_classnames` therefore protects nothing — measured, in
    // `compress` and in `mangle` both. Reserving the IDENTIFIER is what works.
    //
    // The list is exact rather than guessed: the scan just ran, so these are the
    // classes themselves, read before any bundler touched them. `@fougere/vite`
    // does the same for the hosts that have no module to do it for them.
    // What this app can DESIGNATE, never what it hosts. A CONSUMER hosts nothing and
    // designates everything through `remotes:` — and the guard below used to read
    // `fronds`, so the app most in need of the reservation got none: measured on a Nuxt
    // worker consuming a remote frond, `Product` minified to `f` and the call left as
    // `f.list`, answered `No declared remote hosts 'f'`. The error names the mangled
    // letter, which is the only reason it was findable at all.
    const designated = [
      ...fronds.flatMap((frond) => frond.entities.map((e) => (e.entityClass as unknown as { name: string }).name)),
      ...(await syncedEntityNames(rootDir, conventions)),
    ];
    const entityNames = [...new Set(designated)];
    if (Object.keys(config.remotes ?? {}).length > 0 && entityNames.length === 0) {
      useLogger('fougere').warn(
        'fougere: this app declares `remotes:` and no entity name could be reserved against the minifier.\n'
        + '  A class name IS the JSON-RPC method, so a mangled one leaves as `f.list` and the remote refuses it.\n'
        + '  Run `fougere sync` so the remote entities land in .fougere/, or keep a frond of your own.',
      );
    }
    if (entityNames.length > 0) {
      const vite = (nuxt.options.vite ??= {});
      const build = (vite.build ??= {});
      build.minify = 'terser';
      const terser = (build.terserOptions ??= {});
      const mangle = ((terser as Record<string, any>).mangle ??= {});
      mangle.reserved = [...new Set([...(mangle.reserved ?? []), ...entityNames])];
    }

    // ── 1c. Register aliases for synced remote fronds (.fougere/remotes.json) ──
    const remotesPath = resolve(rootDir, '.fougere', 'remotes.json');
    if (existsSync(remotesPath)) {
      try {
        const remotes = JSON.parse(readFileSync(remotesPath, 'utf-8')) as Record<string, { url: string; path: string }>;
        for (const [name, meta] of Object.entries(remotes)) {
          // Don't override locally scanned fronds
          const specifier = frondPackage(name, conventions);
          if (!nuxt.options.alias[specifier]) {
            nuxt.options.alias[specifier] = meta.path;
            // Ensure Vite/Nitro can resolve files inside synced remotes
            nuxt.options.build.transpile.push(meta.path);
          }
        }
      } catch { /* corrupt remotes.json — skip */ }
    }

    // ── 2. Composables — the primitives, nothing else ──
    addImports([
      { name: 'useQuery', from: runtimeResolve('composables/useFougereData') },
      { name: 'useCommand', from: runtimeResolve('composables/useFougereData') },
      { name: 'useFormFor', from: runtimeResolve('composables/useFormFor') },
      { name: 'useCurrentUser', from: runtimeResolve('composables/useCurrentUser') },
    ]);

    // ── 3. Server: call envelope endpoint + catch-all route + shared utils ────
    addServerHandler({
      route: '/_fougere/call',
      method: 'post',
      handler: runtimeResolve('server/routes/call.post'),
    });
    // The same door, per audience: `/_fougere/call/public` serves the surface named
    // `public`, the way `generateRoutes(app, { surface })` does for REST. The handler
    // reads the segment (see `surfaceOf`).
    addServerHandler({
      route: '/_fougere/call/**',
      method: 'post',
      handler: runtimeResolve('server/routes/call.post'),
    });
    addServerHandler({
      route: '/_fougere/session',
      method: 'get',
      handler: runtimeResolve('server/routes/session.get'),
    });
    // Session hydration — the page ships with its user, no round-trip
    addPlugin({ src: runtimeResolve('plugins/session.server'), mode: 'server' });
    addServerHandler({
      route: '/api/**',
      handler: runtimeResolve('server/api/crud'),
    });
    addServerImportsDir(runtimeResolve('server/utils'));

    // ── 5b. Auth (mounted when fougere.config.ts declares `auth`) ──
    if (config.auth) {
      // Session middleware — resolves user on every request
      addServerHandler({
        middleware: true,
        handler: runtimeResolve('server/auth/middleware/auth'),
      });
      // Auth catch-all route (login, register, callback, etc.)
      addServerHandler({
        route: '/auth/**',
        handler: runtimeResolve('server/auth/routes/auth/[...]'),
      });
      // /api/me — current user endpoint
      addServerHandler({
        route: '/api/me',
        method: 'get',
        handler: runtimeResolve('server/auth/routes/api/me.get'),
      });
    }

    // ── 6. The scan, written down (virtual — lives in .nuxt/) ───
    //
    // The module ALREADY scanned, above. Without this the generated plugin scanned a
    // second time, at runtime — which is right on a server and impossible on a Worker:
    // measured on workerd, `readdir` throws through unenv's shim and the app boots with
    // ZERO fronds. Every page renders, every door answers NOT_FOUND, and only the scan
    // diagnostics say why. One scan, one value, handed to the boot.
    //
    // `emitScan` writes imports relative to where the module SITS, so the destination is
    // settled before the source is produced — `dst` is that path.
    const scanTpl = addTemplate({
      filename: 'fougere-scan.ts',
      write: true,
      getContents: ({ nuxt: n }) =>
        emitScan(scan, { outFile: resolve(n!.options.buildDir, 'fougere-scan.ts') }),
    });

    // ── 6b. Boot plugin (virtual — lives in .nuxt/) ───
    const allSeeds = orderSeeds(fronds);
    const bootTpl = addTemplate({
      filename: 'fougere-boot.ts',
      write: true,
      getContents: () => generateBootPlugin(config, allSeeds, runtimeResolve('server/utils/boot'), scanTpl.dst),
    });
    addServerPlugin(bootTpl.dst);

  },
});

export default module;

// ── Boot plugin generation ─────────────────────────
// Exported (not just module-internal) so its output is unit-testable without
// spinning up a whole Nuxt build.

/**
 * What of the config a generated plugin can carry: values, never providers.
 *
 * `auth` holds a live object built by `betterAuth(...)`, so it cannot be written into a
 * module — and it needs a database, which a codegen'd host has already resolved its own
 * way. The rest is data and travels.
 */
function carried(config: FougereConfig): Partial<FougereConfig> {
  const { remotes, adapters, sources } = config as FougereConfig & { sources?: unknown };
  return {
    ...(remotes ? { remotes } : {}),
    ...(adapters ? { adapters } : {}),
    ...(sources ? { sources } : {}),
  } as Partial<FougereConfig>;
}

/**
 * The entity names a SYNCED remote brought in — `fougere sync` writes the classes under
 * `.fougere/`, and a consumer designates them exactly as it designates its own.
 *
 * By filename and not by loading them: this runs before the loader is installed, and a
 * class file is named after its class by the same convention the scan reads.
 */
async function syncedEntityNames(rootDir: string, conventions: Conventions): Promise<string[]> {
  const remotesPath = resolve(rootDir, '.fougere', 'remotes.json');
  if (!existsSync(remotesPath)) return [];
  try {
    const remotes = JSON.parse(readFileSync(remotesPath, 'utf-8')) as Record<string, { path: string }>;
    const names: string[] = [];
    for (const { path } of Object.values(remotes)) {
      const dir = resolve(path, conventions.dirs.entities);
      if (!existsSync(dir)) continue;
      for (const file of readdirSync(dir)) {
        const name = file.replace(/\.(ts|js|tsx)$/, '');
        if (name !== file) names.push(name);
      }
    }
    return names;
  } catch {
    return [];
  }
}

export function generateBootPlugin(
  config: FougereConfig,
  seeds: SeedEntry[],
  fougereAppPath: string,
  /** The module `emitScan` wrote. Absent only in the tests that predate it. */
  scanPath?: string,
): string {
  const lines: string[] = [];
  lines.push(`// Auto-generated by @fougere/nuxt — do not edit`);
  // Explicit imports — nitro's auto-imports don't reach this template in a prod build
  lines.push(`import { defineNitroPlugin } from 'nitropack/runtime';`);
  lines.push(`import { configureFougere } from '${fougereAppPath}';`);
  // A STATIC import, because that is the one thing a bundler needs spelled out — and the
  // whole point is that nothing reads a directory once this file is built.
  if (scanPath) lines.push(`import { scan } from '${scanPath}';`);

  const db = config.db ?? 'sqlite';
  const sources = (config as { sources?: unknown }).sources;

  // `declaresStorage` is the canonical reader of `db:` — asked, not re-interpreted.
  // Reading `dialect` here made this codegen a SECOND reader, and the two disagreed:
  // any value but 'sqlite' emitted an empty plugin, so no config, no seeds, not a word.
  // resolveStorage now refuses an unresolvable dialect by name, at boot, out loud.
  // An app with no storage still has FRONDS, and the scan is what says so. This used to
  // emit an empty plugin, which threw the scan away with the storage — two unrelated
  // facts, one early return. What a plugin with no storage states is exactly the scan.
  if (!declaresStorage(db as Parameters<typeof declaresStorage>[0])) {
    lines.push(``);
    lines.push(`export default defineNitroPlugin(() => {`);
    if (scanPath) lines.push(`  configureFougere({ scan, config: ${JSON.stringify(carried(config))} });`);
    lines.push(`});`);
    return lines.join('\n') + '\n';
  }

  // The generated plugin names no storage package — resolution lives in
  // @fougere/defaults, the one place that knows which engine backs `db:`.
  lines.push(`import { resolveStorage } from '@fougere/defaults';`);
  // After the early return above: an app that declares no storage generates no imports.
  lines.push(`import { migrating${seeds.length ? ', runSeeds' : ''} } from '@fougere/core';`);
  lines.push(``);

  // Seed imports
  for (let i = 0; i < seeds.length; i++) {
    lines.push(`import seed_${i} from '${seeds[i].filePath}';`);
  }
  if (seeds.length) lines.push(``);

  // Wrap all init in the plugin callback to avoid top-level native calls
  lines.push(`export default defineNitroPlugin(async () => {`);
  // The SCAN first, and on its own line: it names no engine, so nothing below can stop it
  // from being stated. Measured on workerd — `resolveStorage` threw on a native driver,
  // Nitro swallowed the plugin whole, and the app came up with zero fronds and not a word.
  // Two unrelated facts had been sharing one failure.
  // The scan AND what the config says about topology — both read at build, both stated
  // here rather than re-derived. `remotes` is the whole reason a consumer boots at all:
  // without it the app hosts nothing and reaches nothing, and its pages render empty.
  if (scanPath) lines.push(`  configureFougere({ scan, config: ${JSON.stringify(carried(config))} });`);
  lines.push(`  try {`);
  // Pass `db` through unchanged — resolveStorage (@fougere/defaults → setupSqlite)
  // is the one place that defaults an absent path, so both call sites (this
  // codegen'd plugin and fougereApp.ts's own fallback) land on the same file.
  // The second argument only appears when there is something to say: an app with one
  // database generates exactly the line it generated before.
  const sourcesArg = sources ? `, ${JSON.stringify(sources)}` : '';
  lines.push(`    const storage = resolveStorage(${JSON.stringify(db)}${sourcesArg});`);
  lines.push(``);
  lines.push(`    configureFougere({`);
  if (scanPath) lines.push(`      scan,`);
  lines.push(`      config: ${JSON.stringify(carried(config))},`);
  lines.push(`      db: storage.db,`);
  lines.push(`      ormFactory: storage.ormFactory,`);
  // Two members of the ascent, named — not a claim on everything after the boot. The
  // storage's is core's own declaration (`migrating`), so this codegen states no order and
  // cannot mistype the name it would otherwise be silently adding beside.
  lines.push(`      extensions: [`);
  lines.push(`        migrating(storage.migrate),`);

  if (seeds.length) {
    // The seeding LOOP is core's (`runSeeds`), not written out here: a second copy
    // drifted, and the one that had lost its storage fallback was this one — the one
    // that actually runs when you open the app. Codegen's only job is the static
    // imports, which is the one thing a bundler needs spelled out.
    //
    // Naming it 'seeds' REPLACES core's default member rather than running beside it —
    // which is what the old `afterBoot` claim achieved by taking over the whole post-boot.
    //
    // `report` is passed: its default is a no-op, so the boot you actually open said
    // nothing about a skipped seed — the very silence F-12 was aggravated by.
    lines.push(`        { name: 'seeds', up: (app) => runSeeds(app, [`);
    for (let i = 0; i < seeds.length; i++) {
      lines.push(`          { entityName: '${seeds[i].entityName}', data: seed_${i}, filePath: ${JSON.stringify(seeds[i].filePath)} },`);
    }
    lines.push(`        ], (message) => console.log('[fougere:seed]' + message)) },`);
  }

  lines.push(`      ],`);
  lines.push(`    });`);
  // A storage that could not be opened is REPORTED, never swallowed. Nitro takes a
  // throwing plugin quietly, and the app then serves its pages with an empty domain —
  // the failure mode this whole file exists to make impossible. The scan above already
  // stands, so what is lost here is the storage and nothing else, and the line says which.
  lines.push(`  } catch (cause) {`);
  lines.push(`    console.error('[fougere] storage could not be opened — the app serves its fronds with no rows.');`);
  lines.push(`    console.error(cause);`);
  lines.push(`  }`);
  lines.push(`});`);

  return lines.join('\n') + '\n';
}
