/**
 * A computed field receives the PAGE, and asking for a row is caught at the scan.
 *
 * `items(order: Order)` compiles — the executor calls it with the rows array and the
 * body then reads `order.holder` off an array — and dies at the first call with
 * `expected 1 value(s) for 1 row(s), got 0`. The shape was readable at the scan, which
 * strips that first parameter without ever looking at it.
 */
import { describe, expect, it } from 'vitest';
import { join } from 'node:path';
import { scanProject } from '../src/node.js';

const root = join(import.meta.dirname, 'fixtures-presenter-row-form');

describe('a computed field that asks for a row', () => {
  it('is reported, naming the method and the shape to write', async () => {
    const scan = await scanProject(root);
    const found = scan.diagnostics.filter((d) => d.code === 'presenter-field-not-page');

    expect(found).toHaveLength(1);
    expect(found[0]?.subject).toBe('OrderPresenter.label');
    expect(found[0]?.message).toContain('label(order: Order)');
    expect(found[0]?.message).toContain('label(order: Order[])');
    expect(found[0]?.severity).toBe('blocking');
  });

  it('leaves the page form alone', async () => {
    const scan = await scanProject(root);
    const shouted = scan.diagnostics.filter((d) => d.message.includes('shouted'));
    expect(shouted).toEqual([]);
  });
});
