import { describe, it, expect, beforeEach } from 'vitest';
import type { Storage } from '@fougere/core';
import { fougereAdapter } from '../src/adapter.js';

/** In-memory storage that satisfies what the adapter needs (Storage + findBy/findAllBy). */
function makeMemoryStorage(): Storage & {
  findBy(c: Record<string, unknown>): Promise<Record<string, unknown> | undefined>;
  findAllBy(c: Record<string, unknown>): Promise<Record<string, unknown>[]>;
} {
  const store = new Map<string, Record<string, unknown>>();
  let seq = 0;
  const matches = (row: Record<string, unknown>, criteria: Record<string, unknown>) =>
    Object.entries(criteria).every(([k, v]) => row[k] === v);

  return {
    async list(opts) {
      let items = [...store.values()];
      if (opts?.orderBy) {
        const field = opts.orderBy;
        items = [...items].sort((a, b) => {
          const av = a[field], bv = b[field];
          if (av == null && bv == null) return 0;
          if (av == null) return -1;
          if (bv == null) return 1;
          const cmp = av < bv ? -1 : av > bv ? 1 : 0;
          return opts.order === 'desc' ? -cmp : cmp;
        });
      }
      if (opts?.offset !== undefined) items = items.slice(opts.offset);
      if (opts?.limit !== undefined) items = items.slice(0, opts.limit);
      const result = items as ReturnType<Storage['list']> extends Promise<infer R> ? R : never;
      (result as { total?: number }).total = store.size;
      return result as never;
    },
    async findById(id) {
      return store.get(id as string);
    },
    async create(input) {
      const id = (input as { id?: string }).id ?? `mem-${++seq}`;
      const record = { ...input, id };
      store.set(id, record as Record<string, unknown>);
      return record as never;
    },
    async update(id, input) {
      const existing = store.get(id);
      if (!existing) throw new Error(`not found ${id}`);
      const updated = { ...existing, ...input, id };
      store.set(id, updated);
      return updated as never;
    },
    async delete(id) {
      return store.delete(id);
    },
    output(_schema) {
      return this;
    },
    async findBy(criteria) {
      for (const row of store.values()) if (matches(row, criteria)) return row;
      return undefined;
    },
    async findAllBy(criteria) {
      return [...store.values()].filter((r) => matches(r, criteria));
    },
    async findByKeys(ids: readonly string[]) { return new Map((await this.findAllBy({})).filter((r: any) => ids.includes(r.id)).map((r: any) => [r.id, r])); },
    async findAllByKeys() { return new Map(); },
    async upsert(i: any) { return i; },
    async upsertAll(rows: any[]) { return rows.length; },
    /** What this storage wraps — the Kysely instance for the SQL one, the Map here. */
    client: store,
  };
}

describe('fougereAdapter', () => {
  let userStorage: ReturnType<typeof makeMemoryStorage>;
  let adapter: ReturnType<ReturnType<typeof fougereAdapter>>;

  beforeEach(() => {
    userStorage = makeMemoryStorage();
    const storageMap = new Map<string, Storage>([['user', userStorage]]);
    // The factory returns a function — call it with empty BetterAuthOptions to get the runtime adapter.
    adapter = fougereAdapter(storageMap)({} as any);
  });

  it('create routes to Storage.create', async () => {
    // createAdapterFactory injects a generated id; assert email round-trips.
    const created = await adapter.create({
      model: 'user',
      data: { email: 'a@b.c', name: 'A' } as never,
    });
    expect(created).toMatchObject({ email: 'a@b.c', name: 'A' });
    const list = await userStorage.list();
    expect(list).toHaveLength(1);
    expect(list[0]).toMatchObject({ email: 'a@b.c' });
  });

  it('findOne by email uses findBy', async () => {
    await adapter.create({ model: 'user', data: { email: 'x@y.z', name: 'X' } as never });
    const found = await adapter.findOne({
      model: 'user',
      where: [{ field: 'email', value: 'x@y.z', operator: 'eq', connector: 'AND', mode: 'sensitive' }],
    });
    expect(found).toMatchObject({ email: 'x@y.z' });
  });

  it('findMany filters with eq + applies sortBy/limit client-side', async () => {
    await adapter.create({ model: 'user', data: { email: 'a@x.x', name: 'Charlie' } as never });
    await adapter.create({ model: 'user', data: { email: 'b@x.x', name: 'Alice' } as never });
    await adapter.create({ model: 'user', data: { email: 'c@x.x', name: 'Bob' } as never });

    const rows = await adapter.findMany({
      model: 'user',
      sortBy: { field: 'name', direction: 'asc' },
      limit: 2,
    });
    // better-auth's adapter answers `unknown[]` — it is generic over the app's models.
    // Naming the row shape on the array says what this call asked for, once.
    expect((rows as { name: string }[]).map((r) => r.name)).toEqual(['Alice', 'Bob']);
  });

  it('update mutates the matched row by email', async () => {
    const u = await adapter.create({ model: 'user', data: { email: 'a@b.c', name: 'A' } as never });
    const updated = await adapter.update({
      model: 'user',
      where: [{ field: 'email', value: 'a@b.c', operator: 'eq', connector: 'AND', mode: 'sensitive' }],
      update: { name: 'AA' },
    });
    expect(updated).toMatchObject({ id: (u as { id: string }).id, name: 'AA' });
  });

  it('delete removes the row', async () => {
    const u = await adapter.create({ model: 'user', data: { email: 'a@b.c', name: 'A' } as never });
    const id = (u as { id: string }).id;
    await adapter.delete({
      model: 'user',
      where: [{ field: 'id', value: id, operator: 'eq', connector: 'AND', mode: 'sensitive' }],
    });
    expect(await userStorage.findById(id)).toBeUndefined();
  });

  it('count returns the number of matching rows', async () => {
    await adapter.create({ model: 'user', data: { email: 'a@x.x', name: 'A' } as never });
    await adapter.create({ model: 'user', data: { email: 'b@x.x', name: 'B' } as never });
    await adapter.create({ model: 'user', data: { email: 'c@x.x', name: 'C' } as never });
    expect(await adapter.count({ model: 'user' })).toBe(3);
  });

  it('throws on unsupported operator', async () => {
    await adapter.create({ model: 'user', data: { email: 'a@b.c', name: 'A' } as never });
    await expect(
      adapter.findOne({
        model: 'user',
        where: [{ field: 'email', value: 'a', operator: 'contains', connector: 'AND', mode: 'sensitive' }],
      }),
    ).rejects.toThrow(/contains.*not yet supported/);
  });
});
