/** @fougere/nuxt — Nuxt module. */
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
import { Fronds, orderSeeds, serves, type ScanResult } from '@fougere/core';
import { prefixOf } from '@fougere/app';
import { frondPackage, resolveConventions, keyedFrondEntries, statesModule, type Conventions } from '@fougere/core';
import { emitFacade, emitNames, frondAliases, frondNamesOf, NAMES, REMOTES, appOptionsFileIn, appOptionsIn, setModuleLoader, loadNearestConfig, configFileNear, projectRootOf, remotesOf } from '@fougere/core/node';
import { declaresStorage } from '@fougere/defaults';
import type { SeedEntry, FougereConfig } from '@fougere/core';
import { createJiti } from 'jiti';
import { dirname, resolve, relative, join } from 'node:path';
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';

export interface FougereModuleOptions {
  /** Where `fronds/` lives, relative to the app's rootDir — found on its own (`projectRootOf`), so written only when it is elsewhere. */
  root?: string;

  /** `@fougere/observability` — a span per operation, the four signals, OTLP. */
  observability?: Record<string, unknown> | false;
  /** `@fougere/calls` — the dev panel: a bounded log of what this process dispatched. */
  calls?: Record<string, unknown> | false;
}

const EXTENSION_KEYS = ['observability', 'calls'] as const;

/** What the project asked for, in mount order. `false` is how a key is turned off. */
export function extensionsOf(options: FougereModuleOptions): { key: string; options: unknown }[] {
  return EXTENSION_KEYS
    .filter((key) => options[key] !== undefined && options[key] !== false)
    .map((key) => ({ key, options: options[key] }));
}

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
      resolveModule('./runtime', ...path);
    const rootDir = nuxt.options.rootDir;
    const scanRoot = options.root ? resolve(rootDir, options.root) : projectRootOf(rootDir);
    process.env.FOUGERE_ROOT = scanRoot;

    if (process.stdout?.isTTY && !process.env.NO_COLOR) {
      process.env.FORCE_COLOR ??= '1';
    }

    (nuxt as any).hook('nitro:init', (nitro: any) => {
      nitro.hooks.hook('rollup:before', (_nitro: unknown, rollupConfig: any) => {
        const decided = rollupConfig.treeshake?.moduleSideEffects;
        if (typeof decided !== 'function') return;
        rollupConfig.treeshake.moduleSideEffects = (id: string, external: boolean) => external || decided(id, external);
      });
    });

    (nuxt as any).hook('nitro:config', (nitroConfig: any) => {
      nitroConfig.rollupConfig ??= {};
      nitroConfig.rollupConfig.external ??= [];
      if (Array.isArray(nitroConfig.rollupConfig.external)) {
        nitroConfig.rollupConfig.external.push('@fougere/compiler');
      }
      nitroConfig.experimental = { ...nitroConfig.experimental, asyncContext: true };
      nitroConfig.esbuild = {
        ...nitroConfig.esbuild,
        options: { ...nitroConfig.esbuild?.options, keepNames: true },
      };
    });

    const installLoader = (alias?: Record<string, string>): void => {
      const jiti = createJiti(import.meta.url, { interopDefault: true, ...(alias ? { alias } : {}) });
      setModuleLoader((filePath) => jiti.import(filePath) as Promise<Record<string, unknown>>);
    };
    installLoader();

    const fileConfig = await loadNearestConfig(rootDir);
    const optionsOverride = Object.fromEntries(
      Object.entries(options).filter(([, v]) => v !== undefined),
    ) as Partial<FougereConfig>;
    const config: FougereConfig = { ...fileConfig, ...optionsOverride };

    if ((process.env.FOUGERE_LOG_LEVEL ?? config.logLevel) === 'debug') {
      process.env.CONSOLA_LEVEL ??= '4';
    }
    const conventions = resolveConventions(config.conventions);

    const aliases = await frondAliases(scanRoot, conventions);
    installLoader(aliases);

    const frondsFilter = process.env.FOUGERE_FRONDS?.split(',').map((s) => s.trim()).filter(Boolean);
    const frondsFile = appOptionsFileIn(scanRoot);
    const { scan, statement } = frondsFile
      ? { scan: await statedIn(scanRoot, frondsFile, frondsFilter), statement: undefined }
      : await scanned(scanRoot, frondsFilter, conventions);
    const { fronds } = scan;

    const scope = `${conventions.scope}/*`;
    const local = resolve(scanRoot, conventions.fronds);
    const paths: Record<string, string[]> = {
      [scope]: [local, resolve(scanRoot, REMOTES)].map((dir) => `${relative(nuxt.options.buildDir, dir)}/*`),
    };
    for (const [directory, name] of frondNamesOf(scanRoot, conventions)) {
      paths[`${frondPackage(name, conventions)}/*`] = [`${relative(nuxt.options.buildDir, join(local, directory))}/*`];
    }
    nuxt.options.vite.resolve = { ...nuxt.options.vite.resolve, tsconfigPaths: true } as typeof nuxt.options.vite.resolve;
    nuxt.hook('prepare:types', ({ tsConfig, sharedTsConfig }) => {
      for (const config of [tsConfig, sharedTsConfig]) {
        if (!config) continue;
        config.compilerOptions = { ...config.compilerOptions, paths: { ...config.compilerOptions?.paths, ...paths } };
      }
    });

    for (const [specifier, path] of Object.entries(aliases)) {
      nuxt.options.alias[specifier] = path;
      const watched = [path];
      nuxt.options.watch.push(...watched, ...watched.map(restartsOnFrom(nuxt.options.srcDir)));
    }

    const designated = [
      ...fronds.flatMap((frond) => frond.entities.map((e) => (e.entityClass as unknown as { name: string }).name)),
      ...syncedEntityNames(scanRoot, conventions),
    ];
    const entityNames = [...new Set(designated)];
    if (Object.keys(remotesOf(config)).length > 0 && entityNames.length === 0) {
      useLogger('fougere').warn(
        'fougere: a frond runs elsewhere, and its entity names are unknown here, so the production build may rename them '
        + 'and calls to it would fail. Run `fougere sync` to bring its entities into remotes/.',
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

    addImports([
      { name: 'facade', from: '@fougere/app/client' },
      { name: 'useQuery', from: runtimeResolve('composables/useFougereData') },
      { name: 'useCommand', from: runtimeResolve('composables/useFougereData') },
      { name: 'useFormFor', from: runtimeResolve('composables/useFormFor') },
      { name: 'useCurrentUser', from: runtimeResolve('composables/useCurrentUser') },
    ]);

    const answering = runtimeResolve('server/answer');
    addServerHandler({ route: '/_fougere/call', method: 'post', handler: answering });
    addServerHandler({ route: '/_fougere/call/**', method: 'post', handler: answering });
    addPlugin({ src: runtimeResolve('plugins/session.server'), mode: 'server' });
    if (serves(config.protocols, 'rest')) addServerHandler({ route: `${prefixOf(config.protocols)}/**`, handler: answering });
    if (serves(config.protocols, 'graphql')) {
      addServerHandler({ route: '/graphql', method: 'post', handler: answering });
      addServerHandler({ route: '/graphql/**', method: 'post', handler: answering });
    }
    addServerImportsDir(runtimeResolve('server/utils'));

    addServerHandler({
      middleware: true,
      handler: runtimeResolve('server/auth/middleware/auth'),
    });
    addServerHandler({
      route: '/auth/**',
      handler: runtimeResolve('server/auth/routes/auth/[...]'),
    });

    const statedPath = frondsFile ?? addTemplate({
      filename: 'fougere-fronds.ts',
      write: true,
      getContents: () => statement!,
    }).dst;

    const facadeFile = join(nuxt.options.buildDir, 'fougere-facade.ts');
    addTemplate({
      filename: 'fougere-facade.ts',
      write: true,
      getContents: () => emitFacade(scan, { outFile: facadeFile }),
    });
    nuxt.options.alias['@fronds/facade'] = facadeFile;

    const names = join(scanRoot, NAMES);
    mkdirSync(dirname(names), { recursive: true });
    writeFileSync(names, emitNames(scan));

    const { ordered, cycle } = frondsFile ? { ordered: [], cycle: [] } : orderSeeds(fronds);
    const allSeeds = [...ordered, ...cycle];
    const configFile = configFileNear(rootDir);
    const bootTpl = addTemplate({
      filename: 'fougere-boot.ts',
      write: true,
      getContents: () => generateBootPlugin(config, allSeeds, runtimeResolve('server/utils/boot'), extensionsOf(options), statedPath, scanRoot, config.fronds || config.sources ? configFile : undefined, nuxt.options.dev ? scanRoot : null),
    });
    addServerPlugin(bootTpl.dst);

  },
});

export default module;


function carried(config: FougereConfig): Partial<FougereConfig> {
  const { fronds, protocols, ports, sources, logLevel } = config;

  return {
    ...(fronds ? { fronds } : {}),
    ...(protocols ? { protocols } : {}),
    ...(ports ? { ports } : {}),
    ...(sources ? { sources } : {}),
    ...(logLevel ? { logLevel } : {}),
  } as Partial<FougereConfig>;
}


async function statedIn(root: string, frondsFile: string, only: string[] | undefined): Promise<ScanResult> {
  return { root, fronds: Fronds.list((await appOptionsIn(frondsFile, only)).fronds), diagnostics: [] };
}

async function scanned(root: string, only: string[] | undefined, conventions: Conventions): Promise<{ scan: ScanResult; statement: string }> {
  const compiler = await import('@fougere/compiler').catch((error: NodeJS.ErrnoException) => {
    if (error.code !== 'ERR_MODULE_NOT_FOUND') throw error;
    throw new Error(`${root} has no fronds.ts and @fougere/compiler is not installed. Run \`fougere build\`, or install @fougere/compiler.`);
  });
  const scan = await compiler.scanProject(root, only, conventions);

  return { scan, statement: compiler.emitAppOptions(scan) };
}

function syncedEntityNames(root: string, conventions: Conventions): string[] {
  const remotes = resolve(root, REMOTES);
  if (!existsSync(remotes)) return [];

  return readdirSync(remotes).flatMap((remote) => {
    const entities = resolve(remotes, remote, conventions.dirs.entities);
    const files = existsSync(entities) ? readdirSync(entities) : [];

    return files.filter((file) => /\.(ts|js|tsx)$/.test(file)).map((file) => file.replace(/\.(ts|js|tsx)$/, ''));
  });
}

export function generateBootPlugin(
  config: FougereConfig,
  seeds: SeedEntry[],
  fougereAppPath: string,
  /** What `fougere:` named, in mount order. Empty is the whole of "changed nothing". */
  extensions: { key: string; options: unknown }[] = [],
  /** The app's own `fronds.ts`, when it states what it hosts instead of being scanned. */
  statedPath?: string,
  root?: string,
  configFile?: string,
  storageRoot: string | null | undefined = root,
): string {
  const lines: string[] = [];
  lines.push(`// Auto-generated by @fougere/nuxt — do not edit`);
  lines.push(`import { defineNitroPlugin } from 'nitropack/runtime';`);
  lines.push(`import { configureFougere } from '${fougereAppPath}';`);
  if (statedPath) lines.push(`import fronds, * as statement from '${statedPath.replace(/\.(m?)[jt]sx?$/, '')}';`);
  if (configFile) lines.push(`import config from '${configFile.replace(/\.(m?)[jt]sx?$/, '')}';`);
  const configArg = configFile ? `{ ...${JSON.stringify(carried(config))}, fronds: config.fronds }` : JSON.stringify(carried(config));

  const moduleKeys = keyedFrondEntries(config.fronds).map((entry) => entry.key).filter(statesModule);
  if (moduleKeys.length > 0) {
    lines.push(`import { getModuleLoader, setModuleLoader } from '@fougere/core/node';`);
    moduleKeys.forEach((key, i) => {
      const specifier = key.startsWith('.') ? resolve(root ?? '', key).replace(/\.(m?)[jt]sx?$/, '') : key;
      lines.push(`import * as module_${i} from '${specifier}';`);
    });
    lines.push(`const modules = { ${moduleKeys.map((key, i) => `${JSON.stringify(key)}: module_${i}`).join(', ')} };`);
    lines.push(`const loadModule = getModuleLoader();`);
    lines.push(`setModuleLoader((id, options) => (id in modules ? Promise.resolve(modules[id]) : loadModule(id, options)));`);
  }

  const sources = config.sources;

  if (!declaresStorage(sources)) {
    lines.push(``);
    lines.push(`export default defineNitroPlugin(() => {`);
    const states = statedPath ? 'fronds, vocabulary: statement.vocabulary, ' : '';
    lines.push(`  configureFougere({ ${states}config: ${configArg} });`);
    lines.push(`});`);

    return lines.join('\n') + '\n';
  }

  lines.push(`import { resolveStorage } from '@fougere/defaults';`);
  if (seeds.length) lines.push(`import { runSeeds } from '@fougere/core';`);
  for (const { key } of extensions) {
    lines.push(`import { ${key} } from '@fougere/${key}';`);
  }
  lines.push(``);

  for (let i = 0; i < seeds.length; i++) {
    lines.push(`import seed_${i} from '${seeds[i].filePath}';`);
  }
  if (seeds.length) lines.push(``);

  lines.push(`export default defineNitroPlugin(async (nitroApp) => {`);
  const states = statedPath ? 'fronds, vocabulary: statement.vocabulary, ' : '';
  lines.push(`  configureFougere({ ${states}config: ${configArg} });`);
  lines.push(``);
  lines.push(`  try {`);
  const rootArg = storageRoot ? `, ${JSON.stringify(storageRoot)}` : '';
  lines.push(`    const storage = resolveStorage(${JSON.stringify(sources)}${rootArg});`);
  lines.push(`    nitroApp.hooks.hook('close', () => storage.close?.());`);
  lines.push(``);
  lines.push(`    configureFougere({`);
  if (statedPath) lines.push(`      fronds,`, `      vocabulary: statement.vocabulary,`);
  lines.push(`      config: ${configArg},`);
  lines.push(`      storage,`);
  lines.push(`      extensions: [`);

  if (seeds.length) {
    lines.push(`        { name: 'seeds', up: (app) => runSeeds(app, [`);
    for (let i = 0; i < seeds.length; i++) {
      lines.push(`          { entityName: '${seeds[i].entityName}', data: seed_${i}, filePath: ${JSON.stringify(seeds[i].filePath)} },`);
    }
    lines.push(`        ], (message) => console.log('[fougere:seed]' + message)) },`);
  }

  for (const { key, options } of extensions) {
    lines.push(`        ${key}(${JSON.stringify(options ?? {})}),`);
  }

  lines.push(`      ],`);
  lines.push(`    });`);
  lines.push(`  } catch (cause) {`);
  lines.push(`    console.error('[fougere] storage could not be opened — the app serves its fronds with no rows.');`);
  lines.push(`    console.error(cause);`);
  lines.push(`  }`);
  lines.push(`});`);

  return lines.join('\n') + '\n';
}
