import { text, writeOnly } from '@fougere/schema';
import { describe, expect, it } from 'vitest';
import { OutputView } from '../src/dispatch/OutputView.js';
import { PresenterExecutor } from '../src/module/presenter/PresenterExecutor.js';

describe('OutputView.project', () => {
  const fields = { name: text(), secret: writeOnly(text()) };

  it('applies output boundaries and keeps list metadata', () => {
    const input = Object.assign(
      [{ name: 'Fern', secret: 'hidden' }],
      { total: 1, hasMore: false },
    );

    const output = new OutputView(fields).project(input) as typeof input;

    expect(output[0]).toEqual({ name: 'Fern' });
    expect(output.total).toBe(1);
    expect(output.hasMore).toBe(false);
  });

  it('drops undeclared fields for a closed operation view', () => {
    const output = new OutputView({ name: text() }, true)
      .project({ name: 'Fern', internal: true });

    expect(output).toEqual({ name: 'Fern' });
  });
});

describe('PresenterExecutor', () => {
  it('adds computed fields once per page and keeps list metadata', async () => {
    const input = Object.assign([{ name: 'Fern' }], { total: 1 });
    const presenter = {
      label: (rows: { name: string }[], prefix: string) =>
        rows.map((row) => `${prefix}${row.name}`),
    };

    const output = await new PresenterExecutor(presenter, ['label'])
      .present(input, { label: ['#'] }) as typeof input & { label: string }[];

    expect(output[0]).toEqual({ name: 'Fern', label: '#Fern' });
    expect(output.total).toBe(1);
  });

  it('asks nothing for a field every row already carries, and keeps what a row carried when one lacks it', async () => {
    let asked = 0;
    const presenter = { stock: (rows: { id: string }[]) => (asked++, rows.map(() => 0)) };
    const executor = new PresenterExecutor(presenter, ['stock']);

    expect(await executor.present({ id: 'a', stock: 7 })).toEqual({ id: 'a', stock: 7 });
    expect(asked).toBe(0);
    expect(await executor.present([{ id: 'a', stock: 7 }, { id: 'b' }])).toEqual([{ id: 'a', stock: 7 }, { id: 'b', stock: 0 }]);
    expect(asked).toBe(1);
  });

  it('names the computed field when its cardinality is invalid', async () => {
    const presenter = { label: () => [] };

    await expect(new PresenterExecutor(presenter, ['label'])
      .present([{ name: 'Fern' }]))
      .rejects.toMatchObject({
        code: 'INTERNAL_ERROR',
        message: expect.stringContaining("Computed field 'label' failed"),
      });
  });
});
