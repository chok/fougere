import { text, writeOnly } from '@fougere/schema';
import { describe, expect, it } from 'vitest';
import { OutputProjector } from '../src/dispatch/OutputProjector.js';
import { OutputView } from '../src/dispatch/OutputView.js';
import { PresenterExecutor } from '../src/dispatch/PresenterExecutor.js';

describe('OutputProjector', () => {
  const fields = { name: text(), secret: writeOnly(text()) };

  it('applies output boundaries and keeps list metadata', () => {
    const input = Object.assign(
      [{ name: 'Fern', secret: 'hidden' }],
      { total: 1, hasMore: false },
    );

    const output = new OutputProjector(new OutputView(fields)).project(input) as typeof input;

    expect(output[0]).toEqual({ name: 'Fern' });
    expect(output.total).toBe(1);
    expect(output.hasMore).toBe(false);
  });

  it('drops undeclared fields for a closed operation view', () => {
    const output = new OutputProjector(new OutputView({ name: text() }, true))
      .project({ name: 'Fern', internal: true });

    expect(output).toEqual({ name: 'Fern' });
  });
});

describe('PresenterExecutor', () => {
  it('adds computed fields once per page and keeps list metadata', async () => {
    const input = Object.assign([{ name: 'Fern' }], { total: 1 });
    const presenter = {
      label: (rows: Array<{ name: string }>, prefix: string) =>
        rows.map((row) => `${prefix}${row.name}`),
    };

    const output = await new PresenterExecutor(presenter, ['label'], 'product', 'list')
      .present(input, { label: ['#'] }) as typeof input & Array<{ label: string }>;

    expect(output[0]).toEqual({ name: 'Fern', label: '#Fern' });
    expect(output.total).toBe(1);
  });

  it('names the computed field when its cardinality is invalid', async () => {
    const presenter = { label: () => [] };

    await expect(new PresenterExecutor(presenter, ['label'], 'product', 'list')
      .present([{ name: 'Fern' }]))
      .rejects.toMatchObject({
        code: 'INTERNAL_ERROR',
        entity: 'product',
        operation: 'list',
        message: expect.stringContaining("Computed field 'label' failed"),
      });
  });
});
