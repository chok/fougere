import { randomUUID } from 'node:crypto';
import { mkdir, rename, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import type { ConventionsInput, Diagnostic } from '@fougere/core';
import { statementIn, type Statement } from '@fougere/core/node';
import { scanProject } from './scanner.js';
import { emitStatement } from './statement.js';

/**
 * The statement the scan writes for a project that wrote none — `.fougere/fronds.generated.ts`, beside
 * what `fougere build` writes. It is the PROJECT's, whole: a process narrowed by `only:` filters what
 * it reads, and two of them booting at once read the same file. What the scan could not settle comes
 * back beside it, since the statement states fronds and nothing else.
 */
export async function writeStatement(root: string, conventions?: ConventionsInput): Promise<{ file: string; diagnostics: Diagnostic[] }> {
  const scan = await scanProject(root, undefined, conventions);
  const file = join(root, '.fougere', 'fronds.generated.ts');
  await mkdir(dirname(file), { recursive: true });
  // Renamed into place, so a second boot of the same project reads a whole file, never half of one —
  // and drafted under a name of its own, since two boots of one process may write in the same millisecond.
  const draft = `${file}.${randomUUID()}`;
  await writeFile(draft, emitStatement(scan, { outFile: file }));
  await rename(draft, file);

  return { file, diagnostics: scan.diagnostics };
}

/** The statement the scan writes, read back — narrowed to `only`, the way a host reads it. */
export async function writtenStatement(root: string, scope: { only?: readonly string[]; conventions?: ConventionsInput } = {}): Promise<Statement> {
  return statementIn((await writeStatement(root, scope.conventions)).file, scope.only);
}
