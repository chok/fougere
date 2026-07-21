import { cpSync, existsSync, renameSync, readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

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

  /** Add a frond (business hexagon) under fronds/<name>. */
  addFrond(wsDir: string, template: string, name: string): { path: string } {
    const dest = join(wsDir, 'fronds', name);
    cpSync(join(TEMPLATES, 'fronds', template), dest, { recursive: true });
    const pkgPath = join(dest, 'package.json');
    if (existsSync(pkgPath)) {
      const pkg = JSON.parse(readFileSync(pkgPath, 'utf8')) as { name: string; fougere?: unknown };
      pkg.name = `@frond/${name}`;
      pkg.fougere = { frond: name };
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
}
