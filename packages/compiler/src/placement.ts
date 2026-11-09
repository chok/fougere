/** A file inside a frond that no convention names. */
import { frondDirsOf, type Conventions } from '@fougere/core';
import { type FrondDescriptor } from '@fougere/core/descriptor';
import { readdir } from 'node:fs/promises';
import { join } from 'node:path';

export interface OutsideConvention {
  /** Stable rule name — the same vocabulary `verify()` uses. */
  rule: 'outside-convention';
  frond: string;
  filePath: string;
  kind: 'file' | 'directory';
  message: string;
}

const NOT_SOURCE = new Set(['tests', 'node_modules', 'dist', 'build', 'coverage']);

const FROND_FILES = new Set(['frond.config.ts', 'package.json', 'tsconfig.json', 'README.md']);

/** What sits in a frond outside its convention directories. */
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
          message: `Fougere reads nothing in '${entry.name}/'. A frond's directories are ${addresses}. `
            + `Plain functions go in \`${conventions.dirs.rules}/\`, classes with dependencies in \`${conventions.dirs.services}/\`.`,
        });
        continue;
      }

      if (!entry.name.endsWith('.ts') || FROND_FILES.has(entry.name)) continue;
      found.push({
        rule: 'outside-convention',
        frond: frond.name,
        filePath,
        kind: 'file',
        message: `Fougere reads nothing in '${entry.name}' at the root of the frond '${frond.name}'. `
          + `Plain functions go in \`${conventions.dirs.rules}/\`, classes with dependencies in \`${conventions.dirs.services}/\`.`,
      });
    }
  }

  return found;
}
