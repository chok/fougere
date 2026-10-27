/** Two links in front of one port stand one inside the other, and the frond states the order — never a directory. */
import { describe, it, expect } from 'vitest';
import { join } from 'node:path';
import { scanProject } from '../src/index.js';

const root = join(import.meta.dirname, 'fixtures-middleware-order');

describe('the order of a frond\'s links', () => {
  it('is what frond.config.ts states under ports:, outside in, carried onto the descriptor', async () => {
    const scan = await scanProject(root);
    const ordered = scan.fronds.find((frond) => frond.name === 'ordered')!;

    expect(ordered.ports).toEqual({ Dispatcher: ['Timing', 'Audit'] });
    expect(ordered.providers.map((one) => one.implements)).toEqual([['Dispatcher'], ['Dispatcher']]);
  });

  it('is left to the boot to refuse when nothing states it — the scan reads, the boot judges', async () => {
    const scan = await scanProject(root);

    expect(scan.fronds.find((frond) => frond.name === 'unordered')!.ports).toBeUndefined();
  });
});
