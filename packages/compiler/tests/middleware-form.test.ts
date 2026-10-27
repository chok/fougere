/**
 * What stands around every call is a link in front of `Dispatcher`, read off its `implements`
 * clause like any link; `middlewares/` holds a door's middlewares only, and whatever else sits there
 * is said.
 */
import { describe, it, expect } from 'vitest';
import { join } from 'node:path';
import { scanProject } from '../src/index.js';

const root = join(import.meta.dirname, 'fixtures-middleware');

describe('what stands around a frond\'s calls', () => {
  it('is a service declaring implements Partial<Dispatcher>, asking for its inner', async () => {
    const scan = await scanProject(root);
    const shop = scan.fronds.find((frond) => frond.name === 'shop')!;
    const audit = shop.providers.find((provider) => provider.name === 'Audit');

    expect(audit).toMatchObject({ deps: ['Dispatcher', 'Trail'], implements: ['Dispatcher'] });
    expect(shop.middlewares).toEqual([]);
  });

  it('warns for a class left in middlewares/ that stands at no door, naming the link to write', async () => {
    const { diagnostics } = await scanProject(root);
    const warned = diagnostics.filter((diagnostic) => diagnostic.code === 'middleware-not-a-door');

    expect(warned.map((diagnostic) => [diagnostic.severity, diagnostic.subject]).sort())
      .toEqual([['warning', 'NotAMiddleware'], ['warning', 'Unextended']]);
    expect(warned[0]?.message).toMatch(/implements Partial<Dispatcher>/);
  });
});
