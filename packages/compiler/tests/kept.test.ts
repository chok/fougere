import { describe, it, expect } from 'vitest';
import { join } from 'node:path';
import { scanProject, emitScan } from '../src/index.js';

const root = join(import.meta.dirname, 'fixtures-kept');

describe('a provider stating `implements AsyncDisposable`', () => {
  it('is read as kept, and only that one', async () => {
    const scan = await scanProject(root);
    const kept = scan.fronds[0]!.providers.filter((provider) => provider.kept).map((provider) => provider.ctor.name);

    expect(kept).toEqual(['Ledger']);
  });

  it('survives the emitted scan, so two boots answer the same', async () => {
    const scan = await scanProject(root);
    const written = emitScan(scan, { outFile: join(import.meta.dirname, 'scan.generated.ts') });

    expect(written).toContain('kept: true');
    expect(written.match(/kept: true/g), 'one provider states it, not both').toHaveLength(1);
  });
});
