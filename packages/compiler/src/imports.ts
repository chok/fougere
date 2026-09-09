/** A frond reaching into another one by FILE PATH. */
import type ts from '@typescript/typescript6';
import { readdir, readFile } from 'node:fs/promises';
import { join, resolve, dirname, relative, isAbsolute } from 'node:path';
import type { FrondDescriptor } from './descriptor/frond.js';

let _ts: typeof ts | undefined;
async function loadTs(): Promise<typeof ts> {
  if (!_ts) _ts = (await import('@typescript/typescript6')).default;
  return _ts;
}

export interface CrossFrondImport {
  /** Stable rule name — the same vocabulary `verify()` uses. */
  rule: 'cross-frond-import';
  /** The frond doing the reaching. */
  frond: string;
  filePath: string;
  /** The specifier as written. */
  specifier: string;
  /** The frond the path lands in — absent when it lands outside every frond. */
  target?: string;
  message: string;
}

/** Is `child` inside `parent`? Path-based, so it says nothing about either existing. */
function inside(parent: string, child: string): boolean {
  const rel = relative(parent, child);
  return rel !== '' && !rel.startsWith('..') && !isAbsolute(rel);
}

async function sourcesUnder(dir: string): Promise<string[]> {
  const out: string[] = [];
  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch {
    // Unreadable is the scan's complaint, not this rule's — and an absent directory is
    // ordinary (a frond with no handlers).
    return out;
  }
  for (const entry of entries) {
    if (entry.name === 'node_modules' || entry.name.startsWith('.')) continue;
    const full = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...await sourcesUnder(full));
    else if (entry.name.endsWith('.ts') && !entry.name.endsWith('.d.ts')) out.push(full);
  }
  return out;
}

/** Every relative import that resolves outside its own frond. */
export async function crossFrondImports(
  fronds: readonly Pick<FrondDescriptor, 'name' | 'source'>[],
): Promise<CrossFrondImport[]> {
  const typescript = await loadTs();
  // `source.package` is the scoped name the scan already resolved — the remedy this rule
  // prints must be the name that actually resolves, not one rebuilt from a prefix here.
  const roots = fronds.map((frond) => ({
    name: frond.name, path: resolve(frond.source.path), package: frond.source.package,
  }));
  const found: CrossFrondImport[] = [];

  for (const root of roots) {
    for (const filePath of await sourcesUnder(root.path)) {
      const text = await readFile(filePath, 'utf8').catch(() => undefined);
      if (text === undefined) continue;

      for (const { fileName: specifier } of typescript.preProcessFile(text, true, true).importedFiles) {
        if (!specifier.startsWith('.')) continue;
        const landed = resolve(dirname(filePath), specifier);
        if (inside(root.path, landed)) continue;

        const target = roots.find((other) => other.name !== root.name && inside(other.path, landed));
        found.push({
          rule: 'cross-frond-import',
          frond: root.name,
          filePath,
          specifier,
          ...(target ? { target: target.name } : {}),
          message: target
            ? `'${specifier}' resolves into frond '${target.name}'. A relative path states that `
              + `these two fronds share a directory tree — a constraint nothing declares, and one `
              + `that nothing here can see. Write '${target.package}/…' instead: it says the `
              + `same dependency in terms the model reads, and it is the form \`fougere sync\` writes, `
              + `so it survives '${target.name}' moving out.`
            : `'${specifier}' resolves outside frond '${root.name}', into no frond at all. `
              + `Whatever it reaches is not part of any frond's contract, so nothing carries it `
              + `when this one is deployed on its own.`,
        });
      }
    }
  }
  return found;
}
