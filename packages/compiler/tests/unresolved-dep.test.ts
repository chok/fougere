import { describe, it, expect } from 'vitest';
import { join } from 'node:path';
import { scanProject } from '../src/index.js';

describe('a constructor parameter whose import does not resolve', () => {
  it('refuses the scan, naming the parameter, where the boot used to register the key `any`', async () => {
    await expect(scanProject(join(import.meta.dirname, 'fixtures-unresolved-dep')))
      .rejects.toThrow(/DigestHandler\.ts: constructor parameter 'posts: Facade<PostHandler>' resolves to `any`.*"extends": "@fougere\/core\/tsconfig"/s);
  });

  it('resolves once the fronds extend the tsconfig core ships — one line, no paths', async () => {
    const scan = await scanProject(join(import.meta.dirname, 'fixtures-shared-tsconfig'));
    const digest = scan.fronds.find((frond) => frond.name === 'digest')!;

    expect(digest.handlers[0]!.deps).toEqual(['postHandler']);
  });
});
