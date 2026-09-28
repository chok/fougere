import { execFileSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, mkdtempSync, renameSync, readFileSync, rmSync, writeFileSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { type Conventions, DEFAULT_CONVENTIONS, frondPackage } from '@fougere/core';
import type { Plan } from '../../../src/composer/Plan.js';
import { applyScaffold, type Scaffold } from '../../../src/scaffold/Scaffold.js';
import Shell from './Shell.js';

/**
 * The monorepo's `packages/`, found by its workspace marker rather than counted
 * in `..` from this file. Counting encoded how deep the CLI itself sat, so the
 * day `cli/` moved into a family, `--local` linked four packages instead of
 * twenty-one — silently, because the scan below simply found less.
 *
 * Returns undefined outside the monorepo, which is every installed copy.
 */
function monorepoPackages(): string | undefined {
  let d = fileURLToPath(new URL('.', import.meta.url));
  while (d !== dirname(d)) {
    if (existsSync(join(d, 'pnpm-workspace.yaml'))) return join(d, 'packages');
    d = dirname(d);
  }

  return undefined;
}

/** This package's directory — found by walking up, since the source and its compiled copy sit at different depths. */
function packageRoot(): string {
  let d = fileURLToPath(new URL('.', import.meta.url));
  while (!existsSync(join(d, 'package.json'))) d = dirname(d);

  return d;
}

/**
 * Scaffolds from real template files (create-vite pattern: stdlib copy, no
 * token engine). The workspace model composes at every scale:
 *  - a workspace shell (`workspace/`),
 *  - fronds added from `fronds/<template>`  (business hexagons),
 *  - apps added from `apps/<template>`      (consumers: nuxt, cli).
 * The only per-piece edits are the package names.
 */
const TEMPLATES = join(packageRoot(), 'templates');

/**
 * Where a HOST keeps its starter, or nothing when it ships none.
 *
 * The package that owns the wiring owns the files: `@fougere/nuxt` knows what a
 * `nuxt.config.ts` must say, and a copy of it here would be that knowledge written twice —
 * which is how `templates/apps/` came to hold one host while six were published.
 *
 * Two ways to reach them, and the first is the monorepo's: a host is on disk there, and in
 * every process that installed one for its own reasons.
 */
function starterOf(pkg: string): string | undefined {
  return carried(pkg) ?? fetched(pkg);
}

/**
 * Resolved from the main entry and walked up to the manifest, because a host does not export
 * its own `package.json` and has no reason to.
 *
 * `import.meta.resolve` and not `createRequire().resolve`: a host's `exports` states only the
 * `import` condition, so the CJS resolver answers `ERR_PACKAGE_PATH_NOT_EXPORTED` for every
 * one of them.
 */
function carried(pkg: string): string | undefined {
  let dir: string;
  try {
    dir = dirname(fileURLToPath(import.meta.resolve(pkg)));
  } catch { return undefined; }

  while (!existsSync(join(dir, 'package.json')) && dir !== dirname(dir)) dir = dirname(dir);
  const template = join(dir, 'template');

  return existsSync(template) ? template : undefined;
}

/**
 * The starter of a host this process does not carry, read out of its published tarball.
 *
 * A host is no longer a `dependencies` entry: what is wanted of it is a directory of files, and
 * npm answers a dependency by installing the whole tree behind it — `next` brought 300 MB and
 * `nuxt` its own, so that 28 files weighing 112 KB could be copied. A tarball is 27 to 388 KB,
 * and the peers it names are the scaffolded app's to install, never this CLI's.
 *
 * Pinned to `scaffoldVersion()` for the reason `pinVersions` states, and extracted under that
 * version, so a second call reuses what the first unpacked and a released CLI never reads the
 * starter of another one.
 */
function fetched(pkg: string): string | undefined {
  const dir = join(tmpdir(), 'fougere-starter', `${pkg.replace('/', '-')}@${scaffoldVersion()}`);
  const template = join(dir, 'package', 'template');
  if (existsSync(template)) return template;

  try {
    mkdirSync(dir, { recursive: true });
    const tarball = execFileSync('npm', ['pack', `${pkg}@${scaffoldVersion()}`, '--pack-destination', dir, '--silent'],
      { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
    execFileSync('tar', ['-xzf', join(dir, tarball), '-C', dir, 'package/template'], { stdio: 'ignore' });
  } catch { return undefined; }

  return existsSync(template) ? template : undefined;
}

/**
 * The hosts this CLI can scaffold: the `@fougere/*` packages it is developed against.
 *
 * The dependency list IS the registry — nothing to declare, and a host added to the family
 * appears here the day the CLI names it. It names them under `devDependencies`, because what
 * it wants of a host is a directory of files rather than a module to load, and `dependencies`
 * is what had `npm create fougere` install Next.js and Nuxt to copy 28 files.
 *
 * The NAMES are read here and the FILES only where an app is written, so offering the list
 * costs nothing: resolving all six would fetch six tarballs to print six words.
 */
function hosts(): string[] {
  const manifest = JSON.parse(readFileSync(join(packageRoot(), 'package.json'), 'utf8')) as
    { devDependencies?: Record<string, string> };

  return Object.keys(manifest.devDependencies ?? {})
    .filter((pkg) => pkg.startsWith('@fougere/'))
    .map((pkg) => pkg.slice('@fougere/'.length));
}

/** The version that scaffolds is the version the templates were written for. */
const scaffoldVersion = (): string =>
  (JSON.parse(readFileSync(join(packageRoot(), 'package.json'), 'utf8')) as
    { version: string }).version;

// npm strips a literal .gitignore from published packages — it ships as
// _gitignore and the name is restored on copy.
function restoreGitignore(dir: string): void {
  const gi = join(dir, '_gitignore');
  if (existsSync(gi)) renameSync(gi, join(dir, '.gitignore'));
}

function setPackageName(dir: string, name: string): void {
  const pkgPath = join(dir, 'package.json');
  if (!existsSync(pkgPath)) return;
  const pkg = JSON.parse(readFileSync(pkgPath, 'utf8')) as { name: string };
  pkg.name = name;
  writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n');
}

interface Manifest { dependencies?: Record<string, string>; devDependencies?: Record<string, string> }

/** Both lists a starter names a package in — `@fougere/vite` is a build tool, so it sits in the second. */
function rangesOf(pkg: Manifest): Record<string, string>[] {
  return [pkg.dependencies, pkg.devDependencies].filter((ranges) => ranges !== undefined);
}

export default class ProjectWriter {
  constructor(private shell: Shell = new Shell()) {}

  /**
   * The whole plan, or nothing: it is written beside its destination and moved there once every
   * piece landed, since fetching a host's starter can fail halfway. `replace` removes what the
   * destination held, and only then — a failed write leaves the old project as it was.
   */
  write(plan: Plan, dir: string, options: { local?: boolean; replace?: boolean } = {}): void {
    if (existsSync(dir) && !options.replace) throw new Error(`${basename(dir)}/ already exists.`);

    const staged = mkdtempSync(join(dirname(dir), `.${basename(dir)}-`));
    try {
      this.createWorkspace(staged, plan.name);
      for (const { template, name } of plan.fronds) this.addFrond(staged, template, name);
      for (const { template, name } of plan.apps) this.addApp(staged, template, name);
      this.runApps(staged, plan.apps.map(({ name }) => name));
      this.linkFronds(staged);
      if (options.local) this.linkLocal(staged); else this.pinVersions(staged);
    } catch (error) {
      rmSync(staged, { recursive: true, force: true });
      throw error;
    }

    rmSync(dir, { recursive: true, force: true });
    renameSync(staged, dir);
  }

  /** The workspace shell — fougere.config, pnpm-workspace (fronds/* apps/*), package.json. */
  createWorkspace(dir: string, name: string): { path: string } {
    cpSync(join(TEMPLATES, 'workspace'), dir, { recursive: true });
    restoreGitignore(dir);
    setPackageName(dir, name);

    return { path: dir };
  }

  /** Add a frond (business hexagon) under fronds/<name>. */
  addFrond(wsDir: string, template: string, name: string, conventions: Conventions = DEFAULT_CONVENTIONS): { path: string } {
    const dest = join(wsDir, conventions.fronds, name);
    cpSync(join(TEMPLATES, 'fronds', template), dest, { recursive: true });
    // Only the import name. Carrying the convention is what makes a frond — the scan
    // reads directories. `fougere.frond` IS read now (`scanner.ts`, `frondNameOf`), but
    // it renames the contract, which a freshly scaffolded frond has no reason to do.
    const pkgPath = join(dest, 'package.json');
    if (existsSync(pkgPath)) {
      const pkg = JSON.parse(readFileSync(pkgPath, 'utf8')) as { name: string };
      pkg.name = frondPackage(name, conventions);
      writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n');
    }

    return { path: dest };
  }

  /** Add an app (consumer) under apps/<name>, from the host package that owns its wiring. */
  addApp(wsDir: string, template: string, name: string): { path: string } {
    const dest = join(wsDir, 'apps', name);
    const starter = hosts().includes(template) ? starterOf(`@fougere/${template}`) : undefined;
    if (!starter) throw new Error(`No host ships a starter for '${template}'. Served: ${hosts().join(', ')}.`);

    const manifest = join(starter, 'scaffold.json');
    const scaffold = existsSync(manifest) ? JSON.parse(readFileSync(manifest, 'utf8')) as Scaffold : undefined;
    if (scaffold?.create) {
      mkdirSync(dirname(dest), { recursive: true });
      this.shell.create(scaffold.create, dirname(dest), name);
      applyScaffold(dest, scaffold);
    }
    cpSync(starter, dest, { recursive: true, filter: (source) => source !== manifest });
    restoreGitignore(dest);
    setPackageName(dest, name);

    return { path: dest };
  }

  /**
   * What can be scaffolded, of a kind.
   *
   * A FROND comes from this package: it is Fougere's own vocabulary, entities and handlers,
   * and no other package owns it. An APP comes from its HOST — the registry is the hosts this
   * CLI depends on, so `fougere new` offers what is published rather than what was copied here.
   */
  listTemplates(kind: 'fronds' | 'apps'): string[] {
    if (kind === 'apps') return hosts().sort();

    const dir = join(TEMPLATES, kind);
    if (!existsSync(dir)) return [];

    return readdirSync(dir, { withFileTypes: true }).filter((e) => e.isDirectory()).map((e) => e.name);
  }

  /**
   * One script per app, and `dev` for the first: two apps started together fight over a port and
   * interleave their output, and a terminal app is not a server at all.
   */
  runApps(wsDir: string, apps: string[]): void {
    const path = join(wsDir, 'package.json');
    const pkg = JSON.parse(readFileSync(path, 'utf8')) as { scripts?: Record<string, string> };
    const run = (app: string) => `pnpm -C apps/${app} dev`;
    pkg.scripts = {
      ...(apps.length ? { dev: run(apps[0]) } : {}),
      ...Object.fromEntries(apps.map((app) => [`dev:${app}`, run(app)])),
      ...pkg.scripts,
    };
    writeFileSync(path, JSON.stringify(pkg, null, 2) + '\n');
  }

  /**
   * Every app depends on every frond of the workspace — stated once composition is done,
   * because that is when the names exist.
   *
   * A template cannot carry it: the frond is named at composition time (`blog:catalog`),
   * so a dependency written into `templates/apps/nuxt` would name the template instead
   * and resolve to nothing. Which is what happened — the generated app imported
   * `@fronds/blog` whatever you had called it, and did not start.
   *
   * `fronds/` and `apps/` are the registry, like `listTemplates`: nothing to declare.
   */
  linkFronds(wsDir: string, conventions: Conventions = DEFAULT_CONVENTIONS): void {
    const dirs = (kind: string): string[] => {
      const dir = join(wsDir, kind);
      if (!existsSync(dir)) return [];

      return readdirSync(dir, { withFileTypes: true }).filter((e) => e.isDirectory()).map((e) => e.name);
    };

    const fronds = dirs(conventions.fronds);
    if (fronds.length === 0) return;

    for (const app of dirs('apps')) {
      const pkgPath = join(wsDir, 'apps', app, 'package.json');
      if (!existsSync(pkgPath)) continue;

      const pkg = JSON.parse(readFileSync(pkgPath, 'utf8')) as { dependencies?: Record<string, string> };
      pkg.dependencies ??= {};
      for (const frond of fronds) pkg.dependencies[frondPackage(frond, conventions)] = 'workspace:*';
      writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n');
    }
  }

  /**
   * Every `@fougere/*` dependency, pinned to the version that scaffolded it.
   *
   * The templates say `latest`, which reads as "whatever is current" and is not: pnpm
   * answers from a metadata cache, and a fresh project installed 0.6 while the registry
   * said 0.7 — measured. A version is also what makes an install reproducible, which
   * `latest` never was.
   *
   * Read off this CLI's own package, because the scaffold and the packages it names ship
   * together: the version that wrote the file is the one it was written for.
   */
  pinVersions(wsDir: string, conventions: Conventions = DEFAULT_CONVENTIONS): void {
    const version = scaffoldVersion();
    const manifests = [
      join(wsDir, 'package.json'),
      ...['apps', conventions.fronds].flatMap((kind) => {
        const dir = join(wsDir, kind);
        if (!existsSync(dir)) return [];

        return readdirSync(dir, { withFileTypes: true })
          .filter((e) => e.isDirectory())
          .map((e) => join(dir, e.name, 'package.json'));
      }),
    ];

    for (const path of manifests) {
      if (!existsSync(path)) continue;
      const pkg = JSON.parse(readFileSync(path, 'utf8')) as Manifest;
      let moved = false;
      for (const ranges of rangesOf(pkg)) {
        for (const [name, range] of Object.entries(ranges)) {
          if (!name.startsWith('@fougere/') || range !== 'latest') continue;
          ranges[name] = version;
          moved = true;
        }
      }
      if (moved) writeFileSync(path, JSON.stringify(pkg, null, 2) + '\n');
    }
  }

  /**
   * Dev mode: rewrite every `@fougere/*` dependency in the workspace to a
   * `link:` into this monorepo, so `pnpm install` resolves offline (the
   * packages aren't on npm yet). No-op once the packages are published.
   */
  linkLocal(wsDir: string): void {
    const packages = monorepoPackages();
    if (!packages) return;
    // Read off the monorepo rather than listed here: a hand-kept map knew the seven
    // packages the default templates use, so the first step beyond the default — a
    // GraphQL surface, auth — added a dependency it had never heard of, which stayed
    // on `latest` and broke the install. `@fougere/nuxt` lives in `app/nuxt/` and
    // `@fougere/transport-http` in `transport/http/`, which is exactly why the name is
    // read from each package.json instead of guessed from its directory.
    const dirOf = new Map<string, string>();
    const scan = (dir: string, depth = 0): void => {
      for (const e of readdirSync(dir, { withFileTypes: true })) {
        if (!e.isDirectory() || e.name === 'node_modules') continue;
        const sub = join(dir, e.name);
        const pkgPath = join(sub, 'package.json');
        if (existsSync(pkgPath)) {
          const { name } = JSON.parse(readFileSync(pkgPath, 'utf8')) as { name?: string };
          if (name?.startsWith('@fougere/')) dirOf.set(name, sub);
        } else if (depth === 0) {
          scan(sub, depth + 1);
        }
      }
    };
    scan(packages);
    const linked = new Set<string>();
    const walk = (d: string): void => {
      for (const e of readdirSync(d, { withFileTypes: true })) {
        if (e.name === 'node_modules') continue;
        const f = join(d, e.name);
        if (e.isDirectory()) { walk(f); continue; }
        if (e.name !== 'package.json') continue;
        const pkg = JSON.parse(readFileSync(f, 'utf8')) as Manifest;
        let changed = false;
        for (const ranges of rangesOf(pkg)) {
          for (const dep of Object.keys(ranges)) {
            const local = dirOf.get(dep);
            if (local) { ranges[dep] = `link:${local}`; linked.add(local); changed = true; }
          }
        }
        if (changed) writeFileSync(f, JSON.stringify(pkg, null, 2) + '\n');
      }
    };
    walk(wsDir);
    this.sharePeers(wsDir, linked, dirOf.values());
  }

  sharePeers(wsDir: string, linked: Iterable<string>, monorepo: Iterable<string> = []): void {
    const beside = [...new Set([...linked, ...monorepo])];
    const overrides = new Map<string, string>();
    for (const dir of linked) {
      const { peerDependencies = {} } = JSON.parse(readFileSync(join(dir, 'package.json'), 'utf8')) as
        { peerDependencies?: Record<string, string> };
      for (const peer of Object.keys(peerDependencies)) {
        const copy = join(dir, 'node_modules', peer);
        if (peer.startsWith('@fougere/') || overrides.has(peer) || !existsSync(copy)) continue;
        overrides.set(peer, `link:${copy}`);
      }
    }
    if (overrides.size === 0) return;

    // A package the app names whose OWN peer was just redirected comes from the same place:
    // `react-dom` refuses a `react` of another version, so taking one without the other ran none.
    for (const dependency of this.appDependencies(wsDir)) {
      if (dependency.startsWith('@fougere/') || overrides.has(dependency)) continue;
      for (const dir of beside) {
        const copy = join(dir, 'node_modules', dependency);
        if (!existsSync(join(copy, 'package.json'))) continue;
        const { peerDependencies = {} } = JSON.parse(readFileSync(join(copy, 'package.json'), 'utf8')) as
          { peerDependencies?: Record<string, string> };
        if (!Object.keys(peerDependencies).some((peer) => overrides.has(peer))) continue;
        overrides.set(dependency, `link:${copy}`);
        break;
      }
    }

    const lines = [...overrides].map(([peer, target]) => `  ${peer.includes('/') ? `'${peer}'` : peer}: ${target}`);
    const workspace = join(wsDir, 'pnpm-workspace.yaml');
    writeFileSync(workspace, `${readFileSync(workspace, 'utf8').trimEnd()}\n\noverrides:\n${lines.join('\n')}\n`);
  }

  /** Every package an app of the workspace names, in either list. */
  private appDependencies(wsDir: string): Set<string> {
    const apps = join(wsDir, 'apps');
    if (!existsSync(apps)) return new Set();

    return new Set(readdirSync(apps, { withFileTypes: true })
      .filter((entry) => entry.isDirectory() && existsSync(join(apps, entry.name, 'package.json')))
      .flatMap((entry) => rangesOf(JSON.parse(readFileSync(join(apps, entry.name, 'package.json'), 'utf8')) as Manifest))
      .flatMap((ranges) => Object.keys(ranges)));
  }
}
