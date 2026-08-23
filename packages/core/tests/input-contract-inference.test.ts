/**
 * An inferred input is a convention, so it may remove a declaration only when the
 * signature has exactly one answer. Parameter order is never a tie-breaker.
 */
import { describe, expect, it } from 'vitest';
import { join } from 'node:path';
import { createContainer } from '@fougere/container';
import { createApp } from '../src/index.js';
import { scanProject } from '../src/node.js';
import { contractsKeyOf } from '../src/wire/call.js';

const root = join(import.meta.dirname, 'fixtures-input-contract');
const explicitRoot = join(import.meta.dirname, 'fixtures-input-contract-explicit');

describe('handler input contract inference', () => {
  it('infers no entity input from zero entity candidates', async () => {
    const { fronds } = await scanProject(root);
    const operation = fronds[0].handlers[0].operations.get('health');

    expect(operation?.input).toBeUndefined();
  });

  it('infers the only entity candidate', async () => {
    const { fronds } = await scanProject(root);
    const operation = fronds[0].handlers[0].operations.get('open');

    expect(operation?.input?.getFields()).toHaveProperty('label');
  });

  it('reports every candidate instead of choosing the first, in either order', async () => {
    const { fronds, diagnostics } = await scanProject(root);
    const operations = fronds[0].handlers[0].operations;
    const ambiguous = diagnostics.filter((d) => d.code === 'input-contract-ambiguous');

    expect(operations.get('transfer')?.input).toBeUndefined();
    expect(operations.get('transferReversed')?.input).toBeUndefined();
    expect(ambiguous.map((d) => d.subject).sort()).toEqual([
      'TransferHandler.transfer',
      'TransferHandler.transferReversed',
    ]);
    expect(ambiguous.every((d) => d.severity === 'blocking')).toBe(true);

    const normal = ambiguous.find((d) => d.subject === 'TransferHandler.transfer')!;
    expect(normal.message).toContain('source: Account; destination: Ledger');

    const reversed = ambiguous.find((d) => d.subject === 'TransferHandler.transferReversed')!;
    expect(reversed.message).toContain('destination: Ledger; source: Account');
  });

  it('refuses the boot with the handler, parameters and candidate types', async () => {
    const scan = await scanProject(root);

    await expect(createApp({ scan, createContainer })).rejects.toThrow(
      /TransferHandler\.transfer.*source: Account; destination: Ledger/s,
    );
    await expect(createApp({ scan, createContainer })).rejects.toThrow(
      /TransferHandler\.transferReversed.*destination: Ledger; source: Account/s,
    );
  });

  it('preserves explicitly declared input and provenance when the signature has several candidates', async () => {
    const scan = await scanProject(explicitRoot);

    expect(scan.diagnostics.filter((d) => d.code === 'input-contract-ambiguous')).toEqual([]);
    await using app = await createApp({ scan, createContainer });
    const contract = app.resolve<Map<string, { input?: { getFields(): object } }>>(
      contractsKeyOf('settlement'),
    ).get('settle');

    expect(contract?.input?.getFields()).toHaveProperty('label');
    expect((contract as { binding?: unknown[] })?.binding).toHaveLength(2);
  });
});
