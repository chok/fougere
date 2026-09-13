/**
 * The two directories a project extends the framework through.
 *
 * `vocabulary/` is the only one whose ORDER matters: a file there registers a word at module
 * level, and an entity beside it may write that word — a registry refuses a name it does not
 * hold, so reading `entities/` first turns a legal declaration into a boot failure.
 */
import { describe, it, expect } from 'vitest';
import { join } from 'node:path';
import { scanProject } from '../src/index.js';

const at = (fixture: string) => join(import.meta.dirname, fixture);

describe('a frond that extends the framework', () => {
  it('registers its vocabulary before the entity that writes it', async () => {
    const { fronds } = await scanProject(at('fixtures-conventions'));
    const order = fronds[0]?.entities.find((one) => one.name === 'order');

    expect(order).toBeDefined();
    expect(order!.entityClass.getFields().id.lifecycle?.create).toEqual({ generate: 'ulid' });
  }, 30_000);

  it('carries what it mounts on the process', async () => {
    const { fronds } = await scanProject(at('fixtures-conventions'));

    expect(fronds[0]?.extensions?.map((one) => one.name)).toEqual(['audit']);
  }, 30_000);
});
