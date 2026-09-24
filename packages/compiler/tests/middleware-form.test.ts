/** A middleware is recognized by what it states, not by the directory it sits in. */
import { describe, it, expect } from 'vitest';
import { join } from 'node:path';
import { scanProject } from '../src/index.js';

const root = join(import.meta.dirname, 'fixtures-middleware');

describe('a middleware in a frond', () => {
  it('is recognized by its FORM — a class without `around` is not one', async () => {
    const scan = await scanProject(root);
    const shop = scan.fronds.find((frond) => frond.name === 'shop');

    // `NotAMiddleware` sits in the directory and declares no `around`. The directory does
    // not make a middleware; stating the method does.
    expect(shop?.middlewares.map((middleware) => middleware.name)).toEqual(['Audit']);
  });
});
