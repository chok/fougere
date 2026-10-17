/**
 * What `frond.config.ts` says travels in a scan written down. A host booting from that module never
 * reads the file, and an op whose kind or order the file stated booted in dev and was refused there.
 */
import { describe, it, expect } from 'vitest';
import { join } from 'node:path';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { pathToFileURL } from 'node:url';
import { resolveEffectiveOperations, type ScanResult } from '@fougere/core';
import { scanProject, emitScan, emitStatement } from '../src/index.js';

async function roundTrip(fixture: string): Promise<{ live: ScanResult; written: ScanResult }> {
  const live = await scanProject(join(import.meta.dirname, fixture));
  const outFile = join(mkdtempSync(join(tmpdir(), 'emit-overrides-')), 'scan.generated.ts');
  // Written outside the workspace, so the one bare import it holds is pointed at core itself.
  writeFileSync(outFile, emitScan(live, { outFile, core: import.meta.resolve('@fougere/core') }));

  return { live, written: (await import(pathToFileURL(outFile).href)).scan };
}

describe('a scan written down, with its frond.config.ts', () => {
  it('keeps the contracts the config states, a view included', async () => {
    const { live, written } = await roundTrip('fixtures-config-contract');
    const opsOf = (scan: ScanResult) => {
      const model = resolveEffectiveOperations(scan.fronds);
      const note = scan.fronds[0]!.handlers.find((one) => one.address === 'note')!;

      return model.forHandler(note);
    };

    expect(Object.keys(opsOf(written).get('retitle')!.input!.getFields())).toEqual(Object.keys(opsOf(live).get('retitle')!.input!.getFields()));
    expect(opsOf(written).get('archive')?.kind).toBe('command');
  }, 30_000);

  it('writes the same view in the statement a Nuxt build reads, never as JSON', async () => {
    const statement = emitStatement(await scanProject(join(import.meta.dirname, 'fixtures-config-contract')));

    expect(statement).toMatch(/"note\.retitle": \{ input: \w+\.pick\("title"\)/);
    expect(statement).toContain('"note.archive": { ...{"kind":"command"');
  }, 30_000);
});
