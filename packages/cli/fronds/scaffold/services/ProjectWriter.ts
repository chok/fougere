import { cpSync, existsSync, renameSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Scaffolds a project by copying real template files — the create-vite pattern:
 * stdlib copy, no token engine. Two shapes:
 *  - an app (`base/` + a starter overlaid), the watchable default;
 *  - a standalone frond (`frond/`), the servable business hexagon, no app.
 * The only per-project edits are the package names.
 */
const TEMPLATES = fileURLToPath(new URL('../../../templates/', import.meta.url));

export default class ProjectWriter {
  scaffold(dir: string, name: string, template: string, opts: { frond?: boolean } = {}): { path: string } {
    if (opts.frond) {
      cpSync(join(TEMPLATES, 'frond'), dir, { recursive: true });
      // The placeholder frond dir carries the project's name — the scanner reads
      // the directory name as the frond's registration key.
      const placeholder = join(dir, 'fronds', '__name__');
      const frondDir = join(dir, 'fronds', name);
      if (existsSync(placeholder)) renameSync(placeholder, frondDir);
      const frondPkgPath = join(frondDir, 'package.json');
      if (existsSync(frondPkgPath)) {
        const fp = JSON.parse(readFileSync(frondPkgPath, 'utf8')) as { name: string; fougere?: unknown };
        fp.name = `@frond/${name}`;
        fp.fougere = { frond: name };
        writeFileSync(frondPkgPath, JSON.stringify(fp, null, 2) + '\n');
      }
    } else {
      cpSync(join(TEMPLATES, 'base'), dir, { recursive: true });
      const overlay = join(TEMPLATES, template);
      if (existsSync(overlay)) cpSync(overlay, dir, { recursive: true });
    }

    // npm strips a literal .gitignore from published packages — it ships as
    // _gitignore in the template and the name is restored here.
    const gitignore = join(dir, '_gitignore');
    if (existsSync(gitignore)) renameSync(gitignore, join(dir, '.gitignore'));

    // The only per-project value: the package name.
    const pkgPath = join(dir, 'package.json');
    const pkg = JSON.parse(readFileSync(pkgPath, 'utf8')) as { name: string };
    pkg.name = name;
    writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n');

    return { path: dir };
  }
}
