import { cpSync, existsSync, renameSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Scaffolds a project by copying real template files — `base/` for every
 * project, then `<template>/` overlaid on top. The create-vite pattern:
 * stdlib copy, no token engine. The only per-project edit is the package
 * name; everything else is static, lintable, typecheckable template source.
 */
const TEMPLATES = fileURLToPath(new URL('../../../templates/', import.meta.url));

export default class ProjectWriter {
  scaffold(dir: string, name: string, template: string): { path: string } {
    cpSync(join(TEMPLATES, 'base'), dir, { recursive: true });
    const overlay = join(TEMPLATES, template);
    if (existsSync(overlay)) cpSync(overlay, dir, { recursive: true });

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
