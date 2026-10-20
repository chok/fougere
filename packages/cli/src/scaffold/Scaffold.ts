import { existsSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { PackageManager } from './PackageManager.js';
import { applyEdits, modify } from 'jsonc-parser';
import { builders, generateCode, parseModule } from 'magicast';
import { addNuxtModule, addVitePlugin, getDefaultExportOptions } from 'magicast/helpers';

/**
 * What a host adds to the shell its own tool writes — declared by the host, in `template/scaffold.json`.
 *
 * The shell is the host's: its versions, its tsconfig, its config file are what `create-nuxt` or
 * `create-vite` writes today, not what someone copied here once. Fougere's part is what is left:
 * its dependencies, one line of config, and its pages. A starter with no `create` is copied whole.
 */
export interface Scaffold {
  /** The host's own scaffolder, run with `npx`, a major pinned — `{dir}` stands for the app. */
  create?: string[];
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  wire?: Wire;
  /** What the shell writes and Fougere's pages replace. */
  remove?: string[];
  /** Where TypeScript learns the facade module's path — the host's own place for an alias. */
  facade?: FacadePath;
}

/** The one config gesture that makes a host serve Fougere — three forms, one per kind of host. */
export type Wire =
  | { kind: 'nuxtModule'; file: string; module: string; configKey?: string; options?: Record<string, unknown> }
  | { kind: 'vitePlugin'; file: string; from: string; imported: string; options?: Record<string, unknown> }
  | { kind: 'wrapExport'; file: string; from: string; imported: string; options?: Record<string, unknown> };

/**
 * Two forms, because a host that generates its tsconfig owns its `paths`: SvelteKit writes them from
 * `kit.alias`, and a `paths` beside them would replace its `$lib`.
 */
export type FacadePath =
  | { kind: 'paths'; file: string; compilerOptions?: Record<string, unknown> }
  | { kind: 'kitAlias'; file: string };

/** Where a host writes the facade module, from the app's own directory. */
const FACADE = './.fougere/facade.generated.ts';

/** Fougere's part, over a shell already written in `dir`, for a project whose fronds sit in `fronds` beside `remotes`. */
export function applyScaffold(dir: string, scaffold: Scaffold, fronds: { local: string; remotes: string }): void {
  for (const path of scaffold.remove ?? []) rmSync(join(dir, path), { recursive: true, force: true });
  asMember(dir);
  addDependencies(dir, scaffold);
  if (scaffold.wire) wire(dir, scaffold.wire);
  if (scaffold.facade?.kind === 'paths') pointAtFacade(join(dir, scaffold.facade.file), fronds, scaffold.facade.compilerOptions);
  if (scaffold.facade?.kind === 'kitAlias') aliasFacade(join(dir, scaffold.facade.file), fronds);
}

/**
 * An app is a member of the workspace, which states the package manager and the workspace itself:
 * `create-next-app` writes a `packageManager` of its own and a nested `pnpm-workspace.yaml`.
 */
function asMember(dir: string): void {
  rmSync(join(dir, 'pnpm-workspace.yaml'), { force: true });
  const path = join(dir, 'package.json');
  const pkg = JSON.parse(readFileSync(path, 'utf8')) as Record<string, unknown>;
  delete pkg.packageManager;
  writeFileSync(path, JSON.stringify(pkg, null, 2) + '\n');
}

function addDependencies(dir: string, scaffold: Scaffold): void {
  const path = join(dir, 'package.json');
  const pkg = JSON.parse(readFileSync(path, 'utf8')) as Record<string, Record<string, string> | undefined>;
  for (const list of ['dependencies', 'devDependencies'] as const) {
    if (scaffold[list]) pkg[list] = { ...pkg[list], ...scaffold[list] };
  }
  writeFileSync(path, JSON.stringify(pkg, null, 2) + '\n');
}

function wire(dir: string, gesture: Wire): void {
  const path = join(dir, gesture.file);
  if (!existsSync(path)) throw new Error(`The shell wrote no ${gesture.file} — the host's tool changed what it writes.`);
  const source = readFileSync(path, 'utf8');
  const mod = parseModule(source);

  if (gesture.kind === 'nuxtModule') addNuxtModule(mod, gesture.module, gesture.configKey, gesture.options);
  if (gesture.kind === 'vitePlugin') {
    addVitePlugin(mod, { from: gesture.from, imported: gesture.imported, constructor: gesture.imported, options: gesture.options, index: 0 });
  }
  if (gesture.kind === 'wrapExport') {
    mod.imports.$prepend({ from: gesture.from, imported: gesture.imported });
    const args = gesture.options ? [mod.exports.default, gesture.options] : [mod.exports.default];
    mod.exports.default = builders.functionCall(gesture.imported, ...args);
  }

  write(path, source, mod);
}

/**
 * The alias SvelteKit copies into the tsconfig it generates, stated in `sveltekit()`'s own options.
 * An alias names ONE directory, so a frond `fougere sync` wrote is not reached from a SvelteKit page.
 */
function aliasFacade(path: string, fronds: { local: string }): void {
  const source = readFileSync(path, 'utf8');
  const mod = parseModule(source);
  const plugins = getDefaultExportOptions(mod).plugins as { $callee?: string; $args: Record<string, unknown>[] }[];
  const kit = plugins.find((plugin) => plugin.$callee === 'sveltekit')?.$args[0];
  if (!kit) throw new Error(`${path} calls no sveltekit() — the host's tool changed what it writes.`);
  kit.alias = { ...(kit.alias as Record<string, string> | undefined), '@fronds/facade': FACADE, '@fronds': relativeTo(path, fronds.local) };
  write(path, source, mod);
}

/** Written back in the quotes the shell chose. */
function write(path: string, source: string, mod: ReturnType<typeof parseModule>): void {
  const quote = (source.match(/"/g)?.length ?? 0) > (source.match(/'/g)?.length ?? 0) ? 'double' : 'single';
  writeFileSync(path, generateCode(mod, { format: { quote, objectCurlySpacing: true } }).code.trimEnd() + '\n');
}

/**
 * Adds the two paths a page imports by name — its facade, and `@fronds/<name>` read the way the
 * fronds' own tsconfig reads it — and what the frond's code needs of the program reading it —
 * `create-vite` sets `erasableSyntaxOnly`, which refuses the constructor a handler is injected through.
 * The shell's comments and its own paths stay as they were.
 */
function pointAtFacade(path: string, fronds: { local: string; remotes: string }, compilerOptions: Record<string, unknown> = {}): void {
  const settings: [string[], unknown][] = [
    [['compilerOptions', 'paths', '@fronds/facade'], [FACADE]],
    [['compilerOptions', 'paths', '@fronds/*'], [fronds.local, fronds.remotes].map((dir) => `${relativeTo(path, dir)}/*`)],
    ...Object.entries(compilerOptions).map(([key, value]): [string[], unknown] => [['compilerOptions', key], value]),
  ];
  const text = settings.reduce(
    (current, [key, value]) => applyEdits(current, modify(current, key, value, { formattingOptions: { insertSpaces: true, tabSize: 2 } })),
    readFileSync(path, 'utf8'),
  );
  writeFileSync(path, text);
}

/** `dir` as the file at `path` names it — relative, the way a tsconfig and `kit.alias` both read it. */
function relativeTo(path: string, dir: string): string {
  return relative(dirname(path), dir);
}

/** What a package manager reads beside `package.json` — the apps as members, and which builds may run. */
export function settle(dir: string, manager: PackageManager): void {
  const path = join(dir, 'package.json');
  const pkg = JSON.parse(readFileSync(path, 'utf8')) as Record<string, unknown>;
  if (manager.version) pkg.packageManager = `${manager.name}@${manager.version}`;
  const builds = Object.entries(PackageManager.builds);

  if (manager.name === 'pnpm') {
    writeFileSync(join(dir, 'pnpm-workspace.yaml'), [
      'packages:',
      '  - apps/*',
      '',
      'allowBuilds:',
      ...builds.map(([name, allow]) => `  ${name}: ${allow}`),
      '',
      '# A project is created the day a version is published: the delay pnpm can apply to a fresh',
      '# release would hold back the very version the scaffold was written for.',
      'minimumReleaseAgeExclude:',
      "  - '@fougere/*'",
      '',
    ].join('\n'));
  }
  if (manager.name === 'bun') pkg.trustedDependencies = builds.filter(([, allow]) => allow).map(([name]) => name);
  if (manager.name === 'yarn') {
    pkg.dependenciesMeta = Object.fromEntries(builds.filter(([, allow]) => !allow).map(([name]) => [name, { built: false }]));
    if (!existsSync(join(dir, '.yarnrc.yml'))) writeFileSync(join(dir, '.yarnrc.yml'), 'nodeLinker: node-modules\n');
  }

  writeFileSync(path, JSON.stringify(pkg, null, 2) + '\n');
}
