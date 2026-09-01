import SchemaBuilder from '@pothos/core';
import { describe, expect, it } from 'vitest';
import { entity, many, primary, ref, text } from '@fougere/schema';
import { registerAll } from '../src/auto-register.js';

/**
 * A relation is read once per PAGE, not once per row.
 *
 * graphql-js calls a field resolver once per parent, so before this a page of 50
 * orders asked for its user 50 times — measured, with 5 distinct users behind those
 * 50 calls. The read goes through the target's DOOR and not its storage, because the
 * façade is what applies the presenter and the output view: sourcing the rows
 * elsewhere returned them stripped of their computed fields.
 *
 * The door is `list` with a criterion naming a SET — the very one the `many` dual
 * already used with a single value. No op was added: a criterion learned to name
 * several, so `one` and `many` now read through the same door.
 */
class User extends entity({ id: primary(), name: text() }) {}
class Order extends entity({ id: primary(), userId: ref(User), label: text() }) {}

const PAGE = 50;
const DISTINCT = 5;

function build(userDoor: Record<string, Function>) {
  const orders = Array.from({ length: PAGE }, (_, i) => ({
    id: `o${i}`, userId: `u${i % DISTINCT}`, label: `l${i}`,
  }));
  const app = {
    fronds: [{
      name: 'shop',
      entities: [{ name: 'user', entityClass: User }, { name: 'order', entityClass: Order }],
      handlers: [{ address: 'user', operations: new Map() }, { address: 'order', operations: new Map() }],
      presenters: [],
    }],
    presenterFor: () => undefined,
    resolve: () => { throw new Error('no such registration'); },
    facadeFor: (name: string) => (name === 'order'
      ? { list: async () => orders, findById: async () => undefined }
      : userDoor),
    operationsFor: () => new Map(),
  } as never;

  const builder = new SchemaBuilder({});
  builder.queryType({});
  builder.mutationType({});
  registerAll(builder, app);
  const schema = builder.toSchema();
  const relation = (schema.getTypeMap()['Order'] as any).getFields().user;
  return { orders, relation };
}

/** One page, every row asking for its relation — what graphql-js does for a list field. */
const resolvePage = (relation: any, rows: any[], ctx: unknown) =>
  Promise.all(rows.map((row) => relation.resolve(row, {}, ctx, {})));

describe('a relation is read by the page', () => {
  it('asks the door ONCE for the whole page, deduplicating the keys', async () => {
    const calls: string[][] = [];
    const { orders, relation } = build({
      findById: async () => { throw new Error('the row-at-a-time path must not be taken'); },
      list: async (inv: any) => {
        const ids = inv.query.where.id;
        calls.push(ids);
        return ids.map((id: string) => ({ id, name: `name-${id}` }));
      },
    });

    const users = await resolvePage(relation, orders, {});

    expect(calls).toHaveLength(1);
    expect(calls[0]).toHaveLength(DISTINCT);
    expect(users).toHaveLength(PAGE);
    expect(users[0].name).toBe('name-u0');
    expect(users[PAGE - 1].name).toBe(`name-u${(PAGE - 1) % DISTINCT}`);
  });

  it('never answers two requests out of one read', async () => {
    const seen: unknown[] = [];
    const { orders, relation } = build({
      list: async (inv: any) => {
        seen.push(inv.query.where.id);
        return inv.query.where.id.map((id: string) => ({ id, name: id }));
      },
    });

    // Two contexts, one tick: a batch is scoped by the caller, never by the clock.
    await Promise.all([
      resolvePage(relation, orders, { request: 'a' }),
      resolvePage(relation, orders, { request: 'b' }),
    ]);

    expect(seen).toHaveLength(2);
  });

  it('a key with no row answers null, and the others still arrive', async () => {
    const { orders, relation } = build({
      list: async (inv: any) =>
        inv.query.where.id.filter((id: string) => id !== 'u2').map((id: string) => ({ id, name: id })),
    });

    const users = await resolvePage(relation, orders, {});

    expect(users[2]).toBeNull();
    expect(users[0]).toEqual({ id: 'u0', name: 'u0' });
  });

  it('a door that serves no list keeps the row-at-a-time path rather than losing the relation', async () => {
    let perRow = 0;
    const { orders, relation } = build({
      findById: async (inv: any) => { perRow++; return { id: inv.params.id, name: 'one by one' }; },
    });

    const users = await resolvePage(relation, orders, {});

    expect(perRow).toBe(PAGE);
    expect(users[0].name).toBe('one by one');
  });
});

/**
 * The other direction, batched the same way — and not out of the same read.
 *
 * `one` and `many` walk the same relation from opposite ends, so they must not share
 * a batch: a key answers ONE row on one side and a GROUP on the other.
 */
class Slot extends entity({ id: primary(), shelfId: ref(class Shelf extends entity({ id: primary() }) {}), title: text() }) {}

describe('the many side of a relation', () => {
  it('reads every parent\u2019s children in one query, grouped', async () => {
    const slots = Array.from({ length: 30 }, (_, i) => ({ id: `s${i}`, shelfId: `sh${i % 3}`, title: `t${i}` }));
    const calls: string[][] = [];
    class Shelf extends entity({ id: primary(), label: text(), slots: many(Slot) }) {}
    const app = {
      fronds: [{
        name: 'lib',
        entities: [{ name: 'shelf', entityClass: Shelf }, { name: 'slot', entityClass: Slot }],
        handlers: [{ address: 'shelf', operations: new Map() }, { address: 'slot', operations: new Map() }],
        presenters: [],
      }],
      presenterFor: () => undefined,
      resolve: () => { throw new Error('no such registration'); },
      facadeFor: (name: string) => (name === 'slot'
        ? {
          list: async (inv: any) => {
            const keys = inv.query.where.shelfId;
            calls.push(keys);
            return slots.filter((s) => keys.includes(s.shelfId));
          },
        }
        : { list: async () => [] }),
      operationsFor: () => new Map(),
    } as never;

    const builder = new SchemaBuilder({});
    builder.queryType({});
    builder.mutationType({});
    registerAll(builder, app);
    const schema = builder.toSchema();
    const relation = (schema.getTypeMap()['Shelf'] as any).getFields().slots;

    const shelves = [{ id: 'sh0' }, { id: 'sh1' }, { id: 'sh2' }];
    // ONE context object for the page — what graphql-js hands every resolver of a
    // request. A fresh one per call is a different caller, and gets its own read.
    const ctx = {};
    const groups = await Promise.all(shelves.map((sh) => relation.resolve(sh, {}, ctx, {})));

    expect(calls).toHaveLength(1);
    expect([...calls[0]].sort()).toEqual(['sh0', 'sh1', 'sh2']);
    expect(groups.map((g: any[]) => g.length)).toEqual([10, 10, 10]);
    // A parent with no child gets an empty list, never the whole table.
    expect(await relation.resolve({ id: 'nobody' }, {}, {}, {})).toEqual([]);
  });
});
