import { execFileSync } from 'node:child_process';
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, renameSync, readFileSync, rmSync, writeFileSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { type Conventions, DEFAULT_CONVENTIONS } from '@fougere/core';
import { FACADE, REMOTES } from '@fougere/core/node';
import type { Plan } from '../../../src/composer/Plan.js';
import { PackageManager } from '../../../src/scaffold/PackageManager.js';
import { applyScaffold, settle, type Scaffold } from '../../../src/scaffold/Scaffold.js';
import Shell from './Shell.js';
import { version } from '../../../src/version.js';

function monorepoPackages(): string | undefined {
  let d = fileURLToPath(new URL('.', import.meta.url));
  while (d !== dirname(d)) {
    if (existsSync(join(d, 'pnpm-workspace.yaml'))) return join(d, 'packages');
    d = dirname(d);
  }

  return undefined;
}

function packageRoot(): string {
  let d = fileURLToPath(new URL('.', import.meta.url));
  while (!existsSync(join(d, 'package.json'))) d = dirname(d);

  return d;
}

const TEMPLATES = join(packageRoot(), 'templates');

function copyTree(from: string, to: string, keep: (source: string) => boolean = () => true): void {
  mkdirSync(to, { recursive: true });
  for (const entry of readdirSync(from, { withFileTypes: true })) {
    const source = join(from, entry.name);
    if (!keep(source)) continue;
    if (entry.isDirectory()) copyTree(source, join(to, entry.name), keep);
    else copyFileSync(source, join(to, entry.name));
  }
}

function starterOf(pkg: string): string | undefined {
  return carried(pkg) ?? fetched(pkg);
}

function carried(pkg: string): string | undefined {
  let dir: string;
  try {
    dir = dirname(fileURLToPath(import.meta.resolve(pkg)));
  } catch { return undefined; }

  while (!existsSync(join(dir, 'package.json')) && dir !== dirname(dir)) dir = dirname(dir);
  const template = join(dir, 'template');

  return existsSync(template) ? template : undefined;
}

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

function hosts(): string[] {
  const manifest = JSON.parse(readFileSync(join(packageRoot(), 'package.json'), 'utf8')) as
    { devDependencies?: Record<string, string> };

  return Object.keys(manifest.devDependencies ?? {})
    .filter((pkg) => pkg.startsWith('@fougere/'))
    .map((pkg) => pkg.slice('@fougere/'.length));
}

const scaffoldVersion = version;

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

function filesUnder(dir: string, prefix = ''): string[] {
  return readdirSync(join(dir, prefix), { withFileTypes: true }).flatMap((entry) =>
    entry.isDirectory() ? filesUnder(dir, join(prefix, entry.name)) : [join(prefix, entry.name)]);
}

function rangesOf(pkg: Manifest): Record<string, string>[] {
  return [pkg.dependencies, pkg.devDependencies].filter((ranges) => ranges !== undefined);
}

export default class ProjectWriter {
  constructor(private shell: Shell = new Shell()) {}

  /** Writes the whole plan or nothing; `replace` removes what the destination held only once every piece landed. */
  async write(plan: Plan, dir: string, options: { local?: boolean; replace?: boolean; manager?: PackageManager; progress?: (step: string) => void } = {}): Promise<void> {
    if (existsSync(dir) && !options.replace) throw new Error(`${basename(dir)}/ already exists.`);
    const manager = options.local ? new PackageManager('pnpm') : options.manager ?? PackageManager.of();

    const staged = mkdtempSync(join(dirname(dir), `.${basename(dir)}-`));
    try {
      const progress = options.progress ?? (() => {});
      progress('Writing the workspace');
      this.createWorkspace(staged, plan.name, manager);
      for (const { template, name } of plan.fronds) {
        progress(`Adding the ${name} frond`);
        this.addFrond(staged, template, name);
      }
      for (const { template, name } of plan.apps) await this.addApp(staged, template, name, progress, manager);
      this.addExamples(staged, plan);
      this.runApps(staged, plan.apps.map(({ name }) => name), manager);
      settle(staged, manager);
      if (options.local) this.linkLocal(staged); else this.pinVersions(staged);
    } catch (error) {
      rmSync(staged, { recursive: true, force: true });
      throw error;
    }

    rmSync(dir, { recursive: true, force: true });
    renameSync(staged, dir);
  }

  /** The workspace shell — fougere.config, the fronds' tsconfig, a package.json whose members are the apps. */
  createWorkspace(dir: string, name: string, manager: PackageManager = PackageManager.of()): { path: string } {
    copyTree(join(TEMPLATES, 'workspace'), dir);
    restoreGitignore(dir);
    setPackageName(dir, name);
    for (const file of ['AGENTS.md', 'CLAUDE.md']) {
      const path = join(dir, file);
      writeFileSync(path, readFileSync(path, 'utf8').replace(/__run__ (\w+)/g, (_, script: string) => manager.script(script)));
    }

    return { path: dir };
  }

  /** Add a frond (business hexagon) under fronds/<name>. */
  addFrond(wsDir: string, template: string, name: string, conventions: Conventions = DEFAULT_CONVENTIONS): { path: string } {
    const dest = join(wsDir, conventions.fronds, name);
    copyTree(join(TEMPLATES, 'fronds', template), dest);

    return { path: dest };
  }

  /** Add an app (consumer) under apps/<name>, from the host package that owns its wiring. */
  async addApp(wsDir: string, template: string, name: string, progress: (step: string) => void = () => {}, manager: PackageManager = PackageManager.of()): Promise<{ path: string }> {
    const dest = join(wsDir, 'apps', name);
    const starter = hosts().includes(template) ? starterOf(`@fougere/${template}`) : undefined;
    if (!starter) throw new Error(`No host ships a starter for '${template}'. Served: ${hosts().join(', ')}.`);

    const manifest = join(starter, 'scaffold.json');
    const scaffold = existsSync(manifest) ? JSON.parse(readFileSync(manifest, 'utf8')) as Scaffold : undefined;
    if (scaffold?.create) {
      mkdirSync(dirname(dest), { recursive: true });
      progress(`Writing apps/${name} with ${scaffold.create[0]}`);
      await this.shell.create(scaffold.create, dirname(dest), name, manager);
      progress(`Adding Fougere to apps/${name}`);
      applyScaffold(dest, scaffold, { local: join(wsDir, DEFAULT_CONVENTIONS.fronds), remotes: join(wsDir, REMOTES), facade: join(wsDir, FACADE) });
    }
    copyTree(starter, dest, (source) => source !== manifest);
    restoreGitignore(dest);
    setPackageName(dest, name);
    becomeWorkspace(wsDir);

    return { path: dest };
  }

  /**
   * A page using a frond, in each app whose host has one for it.
   * Ex: `templates/examples/blog/nuxt/`.
   */
  addExamples(wsDir: string, plan: Plan): void {
    for (const frond of plan.fronds) {
      for (const app of plan.apps) {
        const example = join(TEMPLATES, 'examples', frond.template, app.template);
        if (!existsSync(example)) continue;
        const dest = join(wsDir, 'apps', app.name);
        copyTree(example, dest);
        for (const file of filesUnder(example)) {
          const path = join(dest, file);
          writeFileSync(path, readFileSync(path, 'utf8').replaceAll('__frond__', frond.name));
        }
      }
    }
  }

  /** What can be scaffolded: a frond from this package, an app from its host. */
  listTemplates(kind: 'fronds' | 'apps'): string[] {
    if (kind === 'apps') return hosts().sort();

    const dir = join(TEMPLATES, kind);
    if (!existsSync(dir)) return [];

    return readdirSync(dir, { withFileTypes: true }).filter((e) => e.isDirectory()).map((e) => e.name);
  }

  /** One script per app, and `dev` for the first. */
  runApps(wsDir: string, apps: string[], manager: PackageManager = PackageManager.of()): void {
    const path = join(wsDir, 'package.json');
    const pkg = JSON.parse(readFileSync(path, 'utf8')) as { scripts?: Record<string, string> };
    const run = (app: string) => manager.inApp(app, 'dev');
    pkg.scripts = {
      ...(apps.length ? { dev: run(apps[0]), build: manager.inEveryApp('build') } : {}),
      ...Object.fromEntries(apps.map((app) => [`dev:${app}`, run(app)])),
      ...pkg.scripts,
    };
    writeFileSync(path, JSON.stringify(pkg, null, 2) + '\n');
  }

  /** Pins every `@fougere/*` dependency to the version that scaffolded it. */
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

  /** Points every `@fougere/*` dependency at this monorepo with `link:`. */
  linkLocal(wsDir: string): void {
    const packages = monorepoPackages();
    if (!packages) return;
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

  private appDependencies(wsDir: string): Set<string> {
    const apps = join(wsDir, 'apps');
    if (!existsSync(apps)) return new Set();

    return new Set(readdirSync(apps, { withFileTypes: true })
      .filter((entry) => entry.isDirectory() && existsSync(join(apps, entry.name, 'package.json')))
      .flatMap((entry) => rangesOf(JSON.parse(readFileSync(join(apps, entry.name, 'package.json'), 'utf8')) as Manifest))
      .flatMap((ranges) => Object.keys(ranges)));
  }
}

function becomeWorkspace(root: string): void {
  const path = join(root, 'package.json');
  const pkg = JSON.parse(readFileSync(path, 'utf8')) as { workspaces?: string[] };
  if (pkg.workspaces) return;
  writeFileSync(path, JSON.stringify({ ...pkg, workspaces: ['apps/*'] }, null, 2) + '\n');
}
