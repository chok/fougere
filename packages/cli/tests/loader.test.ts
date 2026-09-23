/**
 * A module key is resolved against whoever made the loader — made by the CLI, `'@fougere/…'` was
 * looked for among the CLI's own dependencies and never among the project's.
 */
import { describe, it, expect } from 'vitest';
import { join } from 'node:path';
import { getModuleLoader } from '@fougere/core/node';
import { installLoader } from '../src/loader.js';

const project = join(import.meta.dirname, '../../../demos/auth-better');

describe('the loader a command installs', () => {
  it('resolves a module key from the project, not from the CLI', async () => {
    await installLoader(project);

    const module = await getModuleLoader()('@fougere/auth-better');

    expect(typeof module.betterAuth).toBe('function');
  });
});
