/** A middleware is a class that extends `Middleware`, and whatever else sits beside it is said. */
import { describe, it, expect } from 'vitest';
import { join } from 'node:path';
import { scanProject } from '../src/index.js';

const root = join(import.meta.dirname, 'fixtures-middleware');

describe('a middleware in a frond', () => {
  it('is a class that extends Middleware', async () => {
    const scan = await scanProject(root);
    const shop = scan.fronds.find((frond) => frond.name === 'shop');

    expect(shop?.middlewares.map((middleware) => middleware.name)).toEqual(['Audit']);
  });

  it('warns for a class beside it that does not extend Middleware, whether it states around or not', async () => {
    const { diagnostics } = await scanProject(root);
    const warned = diagnostics.filter((diagnostic) => diagnostic.code === 'middleware-not-extended');

    expect(warned.map((diagnostic) => [diagnostic.severity, diagnostic.subject]).sort())
      .toEqual([['warning', 'NotAMiddleware'], ['warning', 'Unextended']]);
    expect(warned[0]?.message).toMatch(/extends Middleware/);
  });

  it('refuses a class that extends Middleware and declares no around', async () => {
    const { diagnostics } = await scanProject(root);
    const refused = diagnostics.find((diagnostic) => diagnostic.code === 'middleware-without-around');

    expect(refused).toMatchObject({ severity: 'blocking', subject: 'Misspelled' });
  });
});
