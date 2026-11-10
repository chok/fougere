import { randomUUID } from 'node:crypto';
import { mkdir, rename, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { createJiti } from 'jiti';
import { resolveConventions, type ConventionsInput, type CreateAppOptions, type Diagnostic } from '@fougere/core';
import { emitFacade, emitNames, FACADE, frondAliases, loadConfig, NAMES, setModuleLoader, appOptionsIn } from '@fougere/core/node';
import { scanProject } from './scanner.js';
import { emitAppOptions } from './appOptions.js';

async function place(file: string, content: string): Promise<void> {
  await mkdir(dirname(file), { recursive: true });
  const draft = `${file}.${randomUUID()}`;
  await writeFile(draft, content);
  await rename(draft, file);
}

/** Writes `.fougere/fronds.generated.ts` from the scan, for a project that wrote no `fronds.ts`. */
export async function writeAppOptions(root: string, conventions?: ConventionsInput): Promise<{ file: string; diagnostics: Diagnostic[] }> {
  const scan = await scanProject(root, undefined, conventions);
  const file = join(root, '.fougere', 'fronds.generated.ts');
  await place(file, emitAppOptions(scan, { outFile: file }));

  return { file, diagnostics: scan.diagnostics };
}

/** The fronds and the vocabulary the scan writes, read back — narrowed to `only`, the way a host reads it. */
export async function scannedAppOptions(root: string, scope: { only?: readonly string[]; conventions?: ConventionsInput } = {}): Promise<Required<Pick<CreateAppOptions, 'fronds' | 'vocabulary'>>> {
  return appOptionsIn((await writeAppOptions(root, scope.conventions)).file, scope.only);
}

/** What a host writes when it starts: the fronds, the facade and the names, from one scan. */
export async function writeDerived(root: string): Promise<void> {
  const loadingWith = (alias: Record<string, string>): void => {
    const jiti = createJiti(import.meta.url, { interopDefault: true, alias });
    setModuleLoader((filePath: string) => jiti.import(filePath) as Promise<Record<string, unknown>>);
  };

  loadingWith({});
  const stated = (await loadConfig(root)).conventions;
  loadingWith(await frondAliases(root, resolveConventions(stated)));

  const scan = await scanProject(root, undefined, stated);
  const statement = join(root, '.fougere', 'fronds.generated.ts');
  const facade = join(root, FACADE);
  await place(statement, emitAppOptions(scan, { outFile: statement }));
  await place(facade, emitFacade(scan, { outFile: facade }));
  await place(join(root, NAMES), emitNames(scan));
}
