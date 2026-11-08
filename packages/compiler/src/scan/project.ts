import { DEFAULT_CONVENTIONS } from '@fougere/core';
import { type ProviderEntry } from '@fougere/core/descriptor';
import { readdir } from 'node:fs/promises';
import { existsSync, type Dirent } from 'node:fs';
import { join, dirname, resolve as resolvePath } from 'node:path';
import { type Entity, type SchemaView } from '@fougere/schema';
import { loadModule, loadOnce, record } from './run.js';
import { parseSeat } from './Seat.js';

/**
 * An absent convention directory is the ordinary case — a frond without `seeds/` is not a
 * defect.
 */
async function readEntries(path: string): Promise<Dirent[]> {
  try {
    return await readdir(path, { withFileTypes: true });
  } catch (cause) {
    if ((cause as NodeJS.ErrnoException)?.code === 'ENOENT') return [];
    record({
      severity: 'blocking',
      code: 'directory-unreadable',
      filePath: path,
      // The path is NOT repeated here: `filePath` carries it, and a renderer that
      // prints both wraps an absolute path twice into an unreadable box.
      message: 'This directory could not be read, so what it declares is missing from the app.',
      cause,
    });

    return [];
  }
}

export async function dirs(path: string): Promise<string[]> {
  const entries = await readEntries(path);

  return entries.filter((e) => e.isDirectory()).map((e) => e.name);
}

export async function files(path: string): Promise<string[]> {
  const entries = await readEntries(path);

  return entries
    .filter((e) => e.isFile() && (e.name.endsWith('.ts') || e.name.endsWith('.js')))
    .map((e) => join(path, e.name));
}

export async function loadDefault(filePath: string): Promise<unknown> {
  const mod = await loadModule(filePath);

  return mod.default;
}

/**
 * The entities `Repository<…>` names, as the values the boot seats on — each module loaded ONCE per
 * run (`loadOnce`), so the `Author` a seat names is the `Author` the entities directory gave, in this
 * frond or another: a host loading every module afresh handed back a second one, and the statement
 * imported it from the handler that does not export it.
 */
export async function seatOf(filePath: string, projectRoot?: string, base: 'Repository' | 'Collect' | 'Present' = 'Repository'): Promise<Entity[]> {
  const seats = await parseSeat(filePath, projectRoot, base);

  return Promise.all(seats.map(async ({ name, exported: by, filePath: declaredIn }) => {
    const module = await loadOnce(declaredIn);
    const exported = module[by] ?? Object.values(module)
      .find((value) => typeof value === 'function' && (value as { name?: string }).name === name);
    if (!exported) throw new Error(`${filePath}: ${base}<${name}> names a class ${declaredIn} does not export.`);

    return exported as Entity;
  }));
}

export async function loadClass(filePath: string): Promise<ProviderEntry['ctor']> {
  const ctor = await loadDefault(filePath);
  // A convention directory holds classes, because a provider is registered under one and
  // asked for by its type. What is NOT a class — a shared contract, a pure function, a
  // table of constants — belongs in `rules/`, and saying where costs one line: measured
  // twice on a real project, both times a file that had to move.
  //
  // It named the frond's ROOT until the directories became a closed list, which is where
  // `outside-convention` now reports a module — so the two messages sent a reader back
  // and forth. `rules/` is read into the type program and registers nothing.
  if (typeof ctor !== 'function' || !ctor.prototype) {
    throw new Error(
      `${filePath}: the default export is not a class. Export a class, or move plain functions `
      + `to the frond's \`${DEFAULT_CONVENTIONS.dirs.rules}/\`.`,
    );
  }

  return ctor as ProviderEntry['ctor'];
}

export function isEntityClass(value: unknown): value is SchemaView {
  return typeof value === 'function' && 'getFields' in (value as object);
}

// Workspace

/** Walk up from project root to find the monorepo root (pnpm-workspace.yaml + packages/). */
export function findWorkspaceRoot(from: string): string {
  let dir = resolvePath(from);
  while (dir !== dirname(dir)) {
    if (existsSync(join(dir, 'pnpm-workspace.yaml')) && existsSync(join(dir, 'packages'))) return dir;
    dir = dirname(dir);
  }

  return resolvePath(from); // fallback: use project root itself
}
