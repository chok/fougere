/**
 * A repository is where an entity's queries are named — and it exists whether or not
 * anyone wrote one.
 *
 * `EntityOrm` is a port: five generic gestures. "The loud readings" is not one of
 * them, so it used to be spelled at the call site, in the middle of the calculation
 * it feeds. The default repository IS the port, so asking for one never fails; a
 * declared one wins, exactly as a Crud op redefined in a subclass wins over the
 * prefab.
 */
import { describe, it, expect, vi } from 'vitest';
import { join } from 'node:path';
import { createContainer } from '@fougere/container-fougere';
import { createApp, createLocalRunner, Repository, getRepositoryTarget, repositoryKeyOf } from '../src/index.js';
import type { OrmFactory } from '../src/index.js';
import { EMPTY_INVOCATION } from '../src/invocation.js';

const root = join(import.meta.dirname, 'fixtures-repository');

const rows = [{ id: 'r1', db: 91, at: 'now' }];

function makeOrm() {
  const orm = {
    list: vi.fn(async () => rows),
    findById: vi.fn(async () => rows[0]),
    findBy: vi.fn(async () => rows[0]),
    findAllBy: vi.fn(async () => rows),
    create: vi.fn(async () => rows[0]),
    update: vi.fn(async () => rows[0]),
    delete: vi.fn(async () => true),
    output: vi.fn(() => orm),
    client: {},
  };
  return orm;
}

const ormFactory: OrmFactory = (() => makeOrm()) as unknown as OrmFactory;

describe('Repository(Entity)', () => {
  it('remembers the entity it is for', () => {
    class Thing {}
    class ThingRepository extends Repository(Thing) {}

    expect(getRepositoryTarget(ThingRepository)).toBe(Thing);
  });

  it('names its container key from the entity', () => {
    expect(repositoryKeyOf('reading')).toBe('ReadingRepository');
  });

  it('is handed the port, and holds nothing else', () => {
    class Thing {}
    const orm = makeOrm() as never;
    const repo = new (Repository(Thing))(orm);

    expect(repo.orm).toBe(orm);
  });
});

describe('the declared one wins, the default is always there', () => {
  it('resolves a repository nobody wrote — it is the port itself', async () => {
    const app = await createApp({ root, createContainer, ormFactory });
    const out = await createLocalRunner(app)({ entity: 'node', op: 'all' }, EMPTY_INVOCATION);

    // NodeHandler asked for `NodeRepository`, no such file exists, and the call answered.
    expect(out).toEqual(rows);
  });

  it('uses the written one when there is one', async () => {
    const app = await createApp({ root, createContainer, ormFactory });
    const out = await createLocalRunner(app)({ entity: 'reading', op: 'loud' }, EMPTY_INVOCATION);

    // `loud()` exists on no ORM — answering it proves the declared class was injected.
    expect(out).toEqual(rows);
  });

  it('is not a door — a repository method is unreachable from the wire', async () => {
    const app = await createApp({ root, createContainer, ormFactory });

    await expect(
      createLocalRunner(app)({ entity: 'reading', op: 'orm' }, EMPTY_INVOCATION),
    ).rejects.toThrow();
  });
});
