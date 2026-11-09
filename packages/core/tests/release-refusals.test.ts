/**
 * A release asks every refusal of its tree, here and across, before any row moves — and a cycle
 * walked through the guarded storage ends.
 */
import { describe, it, expect } from 'vitest';
import { release, type Releasing, type Rows, type ReleasePeer } from '../src/module/relation/Release.js';
import { RelationGuard } from '../src/module/relation/RelationGuard.js';
import { serveRelationReadings } from '../src/module/relation/readings.js';
import type { Dependent } from '../src/module/relation/Dependent.js';
import type { RowHosts } from '../src/module/relation/RowHosts.js';
import type { RpcAnswer } from '../src/wire/RpcAnswer.js';

type Table = Map<string, Record<string, unknown>>;

function rowsOver(table: Table): Rows {
  return {
    findAllByKeys: async (field, keys) => {
      const found = new Map<string, Record<string, unknown>[]>();
      for (const row of table.values()) {
        const key = String(row[field]);
        if (keys.includes(key)) found.set(key, [...(found.get(key) ?? []), row]);
      }

      return found;
    },
    update: async (id, patch) => { table.set(id, { ...table.get(id), ...patch }); },
    delete: async (id) => table.delete(id),
  };
}

function worldOf(
  tables: Record<string, Table>,
  namers: Record<string, Dependent[]>,
  peers: ReleasePeer[] = [],
  guarded = false,
): Releasing {
  const world: Releasing = {
    dependentsOf: (entity) => namers[entity] ?? [],
    namersOf: (entity) => namers[entity] ?? [],
    rowsOf: (entity) => {
      const table = tables[entity];
      if (!table) return undefined;
      const rows = rowsOver(table);

      return guarded ? new RelationGuard(entity, [], world).guard({ ...rows, create: async () => undefined }) : rows;
    },
    schemaOf: () => undefined,
    journal: () => undefined,
    peers: () => peers,
    marking: async (namer, _target, _keys, _marked, read) => read(world.rowsOf(namer)!),
    forget: async () => undefined,
  };

  return world;
}

const ids = (table: Table) => [...table.keys()].sort();

describe('every refusal before any row moves', () => {
  it('refuses a restrict two levels down without taking out the cascade beside it', async () => {
    const user = new Map([['u', { id: 'u' }]]);
    const badges = new Map([['b', { id: 'b', userId: 'u' }]]);
    const orders = new Map([['o', { id: 'o', buyerId: 'u' }]]);
    const lines = new Map([['l', { id: 'l', orderId: 'o' }]]);
    const world = worldOf({ user, badge: badges, order: orders, line: lines }, {
      user: [{ entity: 'badge', field: 'userId', onDelete: 'cascade' }, { entity: 'order', field: 'buyerId', onDelete: 'cascade' }],
      order: [{ entity: 'line', field: 'orderId', onDelete: 'restrict' }],
    });

    await expect(release('user', 'u', world, [], async () => user.delete('u'))).rejects.toMatchObject({ code: 'CONFLICT' });

    expect([ids(user), ids(badges), ids(orders), ids(lines)]).toEqual([['u'], ['b'], ['o'], ['l']]);
  });

  it('asks every peer before any of them releases, and releases none when one refuses', async () => {
    const user = new Map([['u', { id: 'u' }]]);
    const released: string[] = [];
    const peers: ReleasePeer[] = [
      { refuses: async () => [], release: async () => { released.push('first'); }, forget: async () => undefined },
      {
        refuses: async () => { throw Object.assign(new Error('still named'), { code: 'CONFLICT' }); },
        release: async () => { released.push('second'); },
        forget: async () => undefined,
      },
    ];

    await expect(release('user', 'u', worldOf({ user }, {}, peers), [], async () => user.delete('u')))
      .rejects.toThrow('still named');

    expect(released).toEqual([]);
    expect(ids(user)).toEqual(['u']);
  });

  it('ends a cycle the guarded storage walks back into, and takes both rows out', async () => {
    const cycleUsers = new Map([['cu', { id: 'cu', peerId: 'co' }]]);
    const cycleOrders = new Map([['co', { id: 'co', peerId: 'cu' }]]);
    const world = worldOf({ cycleUser: cycleUsers, cycleOrder: cycleOrders }, {
      cycleUser: [{ entity: 'cycleOrder', field: 'peerId', onDelete: 'cascade' }],
      cycleOrder: [{ entity: 'cycleUser', field: 'peerId', onDelete: 'cascade' }],
    }, [], true);

    const gone = await (world.rowsOf('cycleUser') as Rows).delete('cu');

    expect(gone).toBe(true);
    expect([ids(cycleUsers), ids(cycleOrders)]).toEqual([[], []]);
  });
});

describe('holds, asked of a process that holds no such rows', () => {
  it('refuses rather than answering that nothing is missing', async () => {
    const answers = new Map<string, RpcAnswer>();
    serveRelationReadings((op, answer) => answers.set(op, answer), {} as RowHosts, () => undefined);

    await expect(answers.get('holds')!({ params: { entity: 'user', keys: ['absent'] } } as never))
      .rejects.toMatchObject({ code: 'BAD_REQUEST' });
  });
});
