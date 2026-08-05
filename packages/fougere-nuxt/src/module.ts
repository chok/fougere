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
} from '@nuxt/kit';
import { scanProject, FROND_DIRS, setModuleLoader, loadCascadedConfig, orderSeeds } from '@fougere/core';
import { declaresStorage } from '@fougere/runtime';
import type { SeedEntry, FougereConfig } from '@fougere/core';
import { createJiti } from 'jiti';
import { resolve } from 'node:path';
import { existsSync, readFileSync } from 'node:fs';

export interface FougereModuleOptions {
  /** Override fougere.config.ts values from nuxt.config. Optional. */
  db?: FougereConfig['db'];
  frondsDir?: string;
  /**
   * Where `fronds/` lives, relative to the app's rootDir. Default: the app
   * itself. Set to `../..` for an app under `apps/*` in a workspace whose
   * fronds are shared at the root. Config and `.fougere` stay app-local.
   */
  root?: string;
}


// eslint-disable-next-line @typescript-eslint/no-explicit-any
const module: any = defineNuxtModule<FougereModuleOptions>({
  meta: {
    name: '@fougere/nuxt',
    configKey: 'fougere',
  },

  defaults: {
    frondsDir: 'fronds',
  },

  async setup(options, nuxt) {
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

    // ── 0. Setup TS-aware module loader before reading any user config ──
    const jiti = createJiti(import.meta.url, { interopDefault: true });
    setModuleLoader((filePath) => jiti.import(filePath) as Promise<Record<string, unknown>>);

    // ── 0b. Load fougere.config.ts along the workspace→app cascade (scanRoot is
    //        the workspace when the app declares `root`); module options override. ──
    const fileConfig = await loadCascadedConfig(scanRoot, rootDir);
    const optionsOverride = Object.fromEntries(
      Object.entries(options).filter(([, v]) => v !== undefined),
    ) as Partial<FougereConfig>;
    const config: FougereConfig = { db: 'sqlite', ...fileConfig, ...optionsOverride };

    // ── 1. Scan fronds (filtered by FOUGERE_FRONDS env var) ──
    const frondsFilter = process.env.FOUGERE_FRONDS?.split(',').map((s) => s.trim()).filter(Boolean);
    const { fronds } = await scanProject(scanRoot, frondsFilter);

    // ── 1b. Register @frond/* aliases for all fronds, and watch them ──
    // The scanned fronds ARE the watch list — nothing to declare. Without this, a
    // frond under `apps/../..` sits outside rootDir, so Nuxt never restarts: the scan,
    // the additive migration (once per boot) and the seeds all keep the previous shape,
    // and a field you just added is simply absent with no error anywhere.
    // The root frond IS the scan root, so watching its path would match every write in
    // the project — `.nuxt/`, `node_modules/`, the build output. Its convention
    // directories are the frond, and they are what changes when the domain changes.
    for (const frond of fronds) {
      nuxt.options.alias[`@frond/${frond.name}`] = frond.source.path;
      const watched = frond.source.path === scanRoot
        ? FROND_DIRS.map((dir) => resolve(scanRoot, dir))
        : [frond.source.path];
      nuxt.options.watch.push(...watched);
    }

    // ── 1c. Register aliases for synced remote fronds (.fougere/remotes.json) ──
    const remotesPath = resolve(rootDir, '.fougere', 'remotes.json');
    if (existsSync(remotesPath)) {
      try {
        const remotes = JSON.parse(readFileSync(remotesPath, 'utf-8')) as Record<string, { url: string; path: string }>;
        for (const [name, meta] of Object.entries(remotes)) {
          // Don't override locally scanned fronds
          if (!nuxt.options.alias[`@frond/${name}`]) {
            nuxt.options.alias[`@frond/${name}`] = meta.path;
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

    // ── 6. Boot plugin (virtual — lives in .nuxt/) ───
    const allSeeds = orderSeeds(fronds);
    const bootTpl = addTemplate({
      filename: 'fougere-boot.ts',
      write: true,
      getContents: () => generateBootPlugin(config, allSeeds, runtimeResolve('server/utils/fougereApp')),
    });
    addServerPlugin(bootTpl.dst);

  },
});

export default module;

// ── Boot plugin generation ─────────────────────────
// Exported (not just module-internal) so its output is unit-testable without
// spinning up a whole Nuxt build.

export function generateBootPlugin(
  config: FougereConfig,
  seeds: SeedEntry[],
  fougereAppPath: string,
): string {
  const lines: string[] = [];
  lines.push(`// Auto-generated by @fougere/nuxt — do not edit`);
  // Explicit imports — nitro's auto-imports don't reach this template in a prod build
  lines.push(`import { defineNitroPlugin } from 'nitropack/runtime';`);
  lines.push(`import { configureFougere } from '${fougereAppPath}';`);
  if (seeds.length) lines.push(`import { runSeeds } from '@fougere/core';`);

  const db = config.db ?? 'sqlite';

  // `declaresStorage` is the canonical reader of `db:` — asked, not re-interpreted.
  // Reading `dialect` here made this codegen a SECOND reader, and the two disagreed:
  // any value but 'sqlite' emitted an empty plugin, so no config, no seeds, not a word.
  // resolveStorage now refuses an unresolvable dialect by name, at boot, out loud.
  if (!declaresStorage(db as Parameters<typeof declaresStorage>[0])) {
    lines.push(`export default defineNitroPlugin(() => {});`);
    return lines.join('\n') + '\n';
  }

  // The generated plugin names no storage package — resolution lives in
  // @fougere/runtime, the one place that knows which engine backs `db:`.
  lines.push(`import { resolveStorage } from '@fougere/runtime';`);
  lines.push(``);

  // Seed imports
  for (let i = 0; i < seeds.length; i++) {
    lines.push(`import seed_${i} from '${seeds[i].filePath}';`);
  }
  if (seeds.length) lines.push(``);

  // Wrap all init in the plugin callback to avoid top-level native calls
  lines.push(`export default defineNitroPlugin(async () => {`);
  // Pass `db` through unchanged — resolveStorage (@fougere/runtime → setupSqlite)
  // is the one place that defaults an absent path, so both call sites (this
  // codegen'd plugin and fougereApp.ts's own fallback) land on the same file.
  lines.push(`  const storage = resolveStorage(${JSON.stringify(db)});`);
  lines.push(``);
  lines.push(`  configureFougere({`);
  lines.push(`    db: storage.db,`);
  lines.push(`    ormFactory: storage.ormFactory,`);
  lines.push(`    async afterBoot(app) {`);
  lines.push(`      await storage.afterBoot?.(app);`);

  if (seeds.length) {
    // The seeding LOOP is core's (`runSeeds`), not written out here: a second copy
    // drifted, and the one that had lost its storage fallback was this one — the one
    // that actually runs when you open the app. Codegen's only job is the static
    // imports, which is the one thing a bundler needs spelled out.
    //
    // `report` is passed: its default is a no-op, so the boot you actually open said
    // nothing about a skipped seed — the very silence F-12 was aggravated by.
    lines.push(`      await runSeeds(app, [`);
    for (let i = 0; i < seeds.length; i++) {
      lines.push(`        { entityName: '${seeds[i].entityName}', data: seed_${i}, filePath: ${JSON.stringify(seeds[i].filePath)} },`);
    }
    lines.push(`      ], (message) => console.log('[fougere:seed]' + message));`);
  }

  lines.push(`    },`);
  lines.push(`  });`);
  lines.push(`});`);

  return lines.join('\n') + '\n';
}

