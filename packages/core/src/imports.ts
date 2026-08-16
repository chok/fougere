/**
 * A frond reaching into another one by FILE PATH.
 *
 * `verify()` next door answers the same question — does this app survive a split? — from
 * the MODEL: what a constructor asks for, what a parameter is typed. This one can only be
 * answered from the source text, so it reads files and lives apart rather than making
 * `verify` lose the sentence that says it reads none.
 *
 * ```ts
 * import User from '../../user/entities/User.js';   // these two folders are neighbours
 * import User from '@frond/user/entities/User';     // I depend on the frond named user
 * ```
 *
 * Both resolve today, and that is exactly the trap: a frond declared in `remotes:` is
 * still scanned, its code is still on this disk, so the relative form keeps working right
 * up to the day the folder is not there — an extraction into its own repository, an image
 * that copies one frond. Then it fails at build time, with a message about a file path
 * that says nothing about the model.
 *
 * So a relative path across a boundary is not a bug. It is a **colocation constraint that
 * nothing declares**: real, load-bearing, and invisible to the scan, to the identity card
 * and to `remotes:`. The named form states the same dependency in terms the model can
 * read — and it is the form `fougere sync` writes, so it survives the move.
 */
import type ts from 'typescript';
import { readdir, readFile } from 'node:fs/promises';
import { join, resolve, dirname, relative, isAbsolute } from 'node:path';
import type { FrondDescriptor } from './scan/frond.js';

let _ts: typeof ts | undefined;
async function loadTs(): Promise<typeof ts> {
  if (!_ts) _ts = (await import('typescript')).default;
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

/**
 * Every relative import that resolves outside its own frond.
 *
 * `preProcessFile` rather than a regex or a full parse: it is TypeScript's own scanner for
 * exactly this question, so `// import x from '../../other'` in a comment is not a finding
 * and a specifier split across lines still is.
 */
export async function crossFrondImports(
  fronds: ReadonlyArray<Pick<FrondDescriptor, 'name' | 'source'>>,
): Promise<CrossFrondImport[]> {
  const typescript = await loadTs();
  const roots = fronds.map((frond) => ({ name: frond.name, path: resolve(frond.source.path) }));
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
              + `that nothing here can see. Write '@frond/${target.name}/…' instead: it says the `
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
