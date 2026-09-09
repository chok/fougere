/** A file inside a frond that no convention names. */
import { readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { type Conventions, frondDirsOf } from './scan/conventions.js';
import type { FrondDescriptor } from './descriptor/frond.js';

export interface OutsideConvention {
  /** Stable rule name — the same vocabulary `verify()` uses. */
  rule: 'outside-convention';
  frond: string;
  filePath: string;
  kind: 'file' | 'directory';
  message: string;
}

/**
 * `tests` is not a convention and is not an offence either: `@fougere/testing` reads the
 * LEVEL a case runs at from where its file sits, so a frond holding its own tests is a
 * supported shape (`demos/test-gradient`). The rest are outputs and installs, which are
 * not the project's source at all.
 */
const NOT_SOURCE = new Set(['tests', 'node_modules', 'dist', 'build', 'coverage']);

/** The one file a frond states about itself, at its root. */
const FROND_FILES = new Set(['frond.config.ts', 'package.json', 'tsconfig.json', 'README.md']);

/**
 * What sits in a frond and belongs to no convention — a directory somebody invented, or a
 * module dropped at the root.
 *
 * The eight names are the frond's whole vocabulary, and until now nothing said so: a scan
 * READS them and steps over everything else in silence, so a file outside them is not
 * refused, it is unseen. That silence is what lets a domain word settle wherever it was
 * first needed — most often in the handler that used it, which is a second rule
 * (`handler-declaration`) reporting the same drift one file lower.
 *
 * It names the addresses rather than describing them: a rule that says "put it somewhere
 * better" is advice, and advice is what everybody already had.
 */
export async function outsideConventions(
  fronds: readonly Pick<FrondDescriptor, 'name' | 'source'>[],
  conventions: Conventions,
): Promise<OutsideConvention[]> {
  const known = new Set(frondDirsOf(conventions));
  const addresses = [...known].sort().join(', ');
  const found: OutsideConvention[] = [];

  for (const frond of fronds) {
    const entries = await readdir(frond.source.path, { withFileTypes: true }).catch(() => []);

    for (const entry of entries) {
      if (entry.name.startsWith('.') || NOT_SOURCE.has(entry.name)) continue;
      const filePath = join(frond.source.path, entry.name);

      if (entry.isDirectory()) {
        if (known.has(entry.name)) continue;
        found.push({
          rule: 'outside-convention',
          frond: frond.name,
          filePath,
          kind: 'directory',
          message: `'${entry.name}/' is a directory no convention names, so nothing in it is read `
            + `as anything — it is a subject somebody filed under its own word. A frond's `
            + `directories are ${addresses}. If what it holds computes with nothing injected it `
            + `is \`${conventions.dirs.rules}/\`; if it holds a dependency it is `
            + `\`${conventions.dirs.services}/\`.`,
        });
        continue;
      }

      if (!entry.name.endsWith('.ts') || FROND_FILES.has(entry.name)) continue;
      found.push({
        rule: 'outside-convention',
        frond: frond.name,
        filePath,
        kind: 'file',
        message: `'${entry.name}' sits at the root of '${frond.name}', where the frond states `
          + `itself and nothing else. A frond's directories are ${addresses} — this one belongs `
          + `in \`${conventions.dirs.rules}/\` if it computes with nothing injected, in `
          + `\`${conventions.dirs.services}/\` if it holds a dependency.`,
      });
    }
  }

  return found;
}
