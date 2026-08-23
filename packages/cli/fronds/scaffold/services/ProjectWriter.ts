import { cpSync, existsSync, renameSync, readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { type Conventions, DEFAULT_CONVENTIONS, frondPackage } from '@fougere/core/node';

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

/**
 * Scaffolds from real template files (create-vite pattern: stdlib copy, no
 * token engine). The workspace model composes at every scale:
 *  - a workspace shell (`workspace/`),
 *  - fronds added from `fronds/<template>`  (business hexagons),
 *  - apps added from `apps/<template>`      (consumers: nuxt, cli).
 * The only per-piece edits are the package names.
 */
const TEMPLATES = fileURLToPath(new URL('../../../templates/', import.meta.url));

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

export default class ProjectWriter {
  /** The workspace shell — fougere.config, pnpm-workspace (fronds/* apps/*), package.json. */
  createWorkspace(dir: string, name: string): { path: string } {
    cpSync(join(TEMPLATES, 'workspace'), dir, { recursive: true });
    restoreGitignore(dir);
    setPackageName(dir, name);
    return { path: dir };
  }

  /**
   * The flat shell — one Nuxt app whose root carries the convention, so no `fronds/`
   * and no workspace. `templates/flat/` is that shell; what separates the two shapes is
   * only where the domain lands.
   */
  createFlat(dir: string, name: string): { path: string } {
    cpSync(join(TEMPLATES, 'flat'), dir, { recursive: true });
    restoreGitignore(dir);
    setPackageName(dir, name);
    return { path: dir };
  }

  /**
   * Put a frond template's directories at the project root. Only the directories: at the
   * root the app's own `package.json` is the frond's, and `@fronds/<name>` comes from the
   * directory through the Nuxt module's alias, so the template's package would only
   * duplicate it under a second name.
   */
  addRootFrond(dir: string, template: string): { path: string } {
    const src = join(TEMPLATES, 'fronds', template);
    for (const entry of readdirSync(src, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue;
      cpSync(join(src, entry.name), join(dir, entry.name), { recursive: true });
    }
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

  /** Add an app (consumer) under apps/<name>. */
  addApp(wsDir: string, template: string, name: string): { path: string } {
    const dest = join(wsDir, 'apps', name);
    cpSync(join(TEMPLATES, 'apps', template), dest, { recursive: true });
    restoreGitignore(dest);
    setPackageName(dest, name);
    return { path: dest };
  }

  /** Available templates of a kind ('fronds' | 'apps') — the directory is the registry. */
  listTemplates(kind: 'fronds' | 'apps'): string[] {
    const dir = join(TEMPLATES, kind);
    if (!existsSync(dir)) return [];
    return readdirSync(dir, { withFileTypes: true }).filter((e) => e.isDirectory()).map((e) => e.name);
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
    const walk = (d: string): void => {
      for (const e of readdirSync(d, { withFileTypes: true })) {
        if (e.name === 'node_modules') continue;
        const f = join(d, e.name);
        if (e.isDirectory()) { walk(f); continue; }
        if (e.name !== 'package.json') continue;
        const pkg = JSON.parse(readFileSync(f, 'utf8')) as { dependencies?: Record<string, string> };
        let changed = false;
        for (const dep of Object.keys(pkg.dependencies ?? {})) {
          const local = dirOf.get(dep);
          if (local) { pkg.dependencies![dep] = `link:${local}`; changed = true; }
        }
        if (changed) writeFileSync(f, JSON.stringify(pkg, null, 2) + '\n');
      }
    };
    walk(wsDir);
  }
}
