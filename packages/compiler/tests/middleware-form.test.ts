/** What stands around every call is a link in front of `Dispatcher`, read off its `implements` clause like any link. */
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
  });

});
