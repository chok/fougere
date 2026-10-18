/**
 * The scan written as the statement an author would write, and booted from: what a frond is made
 * of has to come back whole, since a host reading the statement never reads the sources.
 */
import { describe, it, expect } from 'vitest';
import { join } from 'node:path';
import { mkdirSync, writeFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { createJiti } from 'jiti';
import { resolveEffectiveOperations, type FrondDescriptor } from '@fougere/core';
import { scanProject, emitStatement } from '../src/index.js';
import { frondAliases } from '@fougere/core/node';

async function stated(fixture: string): Promise<{ scanned: FrondDescriptor; written: FrondDescriptor; statement: string }> {
  const root = join(import.meta.dirname, fixture);
  const scan = await scanProject(root);
  const statement = emitStatement(scan);
  mkdirSync(join(root, '.fougere'), { recursive: true });
  const file = join(root, '.fougere', 'fronds.generated.ts');
  writeFileSync(file, statement);
  const jiti = createJiti(pathToFileURL(root + '/').href, { interopDefault: true, alias: await frondAliases(root) });
  const [written] = await jiti.import(file, { default: true }) as FrondDescriptor[];

  return { scanned: scan.fronds[0]!, written: written!, statement };
}

describe('a statement written from the scan', () => {
  it('brings back what the frond is made of beyond its classes', async () => {
    const { scanned, written } = await stated('fixtures-statement');

    expect(written.middlewares.map((one) => one.name)).toEqual(['Timing', 'Audit']);
    expect(written.middlewares.map((one) => one.name)).toEqual(scanned.middlewares.map((one) => one.name));
    expect(written.presenters[0]!.fieldMeta).toEqual(scanned.presenters[0]!.fieldMeta);
    expect(written.extensions?.map((one) => one.name)).toEqual(['stamp']);
    expect(written.seeds[0]!.data).toEqual([{ id: 'b1', title: 'Pnin', shelvedAt: new Date('1957-03-07T00:00:00Z') }]);
    expect(written.handlers.map((one) => one.exposed)).toEqual(scanned.handlers.map((one) => one.exposed));
  }, 30_000);

  it('keeps the contracts frond.config.ts states, a view included', async () => {
    const { scanned, written } = await stated('fixtures-config-contract');
    const opsOf = (frond: FrondDescriptor) =>
      resolveEffectiveOperations([frond]).forHandler(frond.handlers.find((one) => one.address === 'note')!);

    expect(Object.keys(opsOf(written).get('retitle')!.input!.getFields())).toEqual(Object.keys(opsOf(scanned).get('retitle')!.input!.getFields()));
    expect(opsOf(written).get('archive')?.kind).toBe('command');
  }, 30_000);

  it('exports the terms of vocabulary/ for the whole process, beside the fronds', async () => {
    const scan = await scanProject(join(import.meta.dirname, 'fixtures-conventions'));
    const statement = emitStatement(scan);

    expect(scan.vocabulary?.map((entry) => entry.term.name)).toEqual(['ulid']);
    expect(statement).toContain("import { ulid as _0_ulid } from '@fronds/shop/vocabulary/ulid.js';");
    expect(statement).toContain('export const vocabulary = [_0_ulid];');
  }, 30_000);
});
