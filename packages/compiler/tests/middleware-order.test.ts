/** Two middlewares of one frond stand one inside the other, and the order is stated, never read off a directory. */
import { describe, it, expect } from 'vitest';
import { join } from 'node:path';
import { scanProject } from '../src/index.js';

const root = join(import.meta.dirname, 'fixtures-middleware-order');

describe('the order of a frond\'s middlewares', () => {
  it('refuses two that nothing orders, giving the line to write', async () => {
    const { diagnostics } = await scanProject(root);
    const refused = diagnostics.find((one) => one.code === 'middlewares-unordered');

    expect(refused).toMatchObject({ severity: 'blocking', subject: 'Audit, Timing' });
    expect(refused?.message).toContain("middlewares: ['Audit', 'Timing']");
  });

  it('stands them in the order frond.config.ts states, outside in', async () => {
    const scan = await scanProject(root);
    const ordered = scan.fronds.find((frond) => frond.name === 'ordered');

    expect(ordered?.middlewares.map((one) => one.name)).toEqual(['Timing', 'Audit']);
  });

  it('refuses one the stated order leaves out', async () => {
    const { diagnostics } = await scanProject(root);

    expect(diagnostics.filter((one) => one.code === 'middlewares-unlisted').map((one) => one.subject)).toEqual(['Audit']);
  });
});
