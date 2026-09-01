import { createAdapterFactory } from 'better-auth/adapters';
import type { CleanedWhere, CustomAdapter } from 'better-auth/adapters';
import type { Storage } from '@fougere/core';

/**
 * Map of better-auth model names ('user', 'session', 'account', ...)
 * to Fougere Storage instances. Built once at boot by create() in index.ts.
 */
export type StorageMap = Map<string, Storage>;

/**
 * Where[] supported subset:
 * - All clauses use 'eq' operator
 * - Implicit AND between clauses (no OR connector)
 * Anything else throws — extend Storage or add an engine-level fallback when needed.
 */
function whereToCriteria(where: readonly CleanedWhere[]): Record<string, unknown> {
  const criteria: Record<string, unknown> = {};
  for (const clause of where) {
    if (clause.operator !== 'eq') {
      throw new Error(
        `[fougereAdapter] Operator '${clause.operator}' not yet supported on field '${clause.field}'. ` +
        `Only 'eq' with implicit AND is implemented.`,
      );
    }
    if (clause.connector === 'OR') {
      throw new Error(`[fougereAdapter] OR connector not yet supported (field '${clause.field}').`);
    }
    criteria[clause.field] = clause.value;
  }
  return criteria;
}

function storageOf(storageMap: StorageMap, model: string): Storage {
  const storage = storageMap.get(model);
  if (!storage) {
    throw new Error(
      `[fougereAdapter] Unknown model '${model}'. ` +
      `Known models: ${[...storageMap.keys()].join(', ')}. ` +
      `Plugins that ship their own schema need entities registered explicitly.`,
    );
  }
  return storage;
}

/**
 * Better-auth adapter that routes every operation through Fougere Storage.
 *
 * This closes the loop: the same `db` resolved by Fougere's bootstrap is the
 * one Storage writes to, and better-auth never touches the storage directly.
 * If Fougere swaps Kysely for another backend, this adapter follows for free.
 */
export function fougereAdapter(storageMap: StorageMap) {
  return createAdapterFactory({
    config: {
      adapterId: 'fougere',
      adapterName: 'Fougere Adapter',
      usePlural: false,
      supportsArrays: false,
      supportsJSON: false,
      // The storage converts both ways now (`schema-sql/src/values.ts`), so better-auth
      // can hand over the Dates and booleans its own types declare.
      supportsDates: true,
      supportsBooleans: true,
    },
    adapter: (): CustomAdapter => ({
      create: async ({ model, data }: { model: string; data: Record<string, unknown> }) => {
        const storage = storageOf(storageMap, model);
        return (await storage.create(data)) as never;
      },

      findOne: async ({ model, where }: { model: string; where: CleanedWhere[] }) => {
        const storage = storageOf(storageMap, model);
        const criteria = whereToCriteria(where);
        if (Object.keys(criteria).length === 1 && 'id' in criteria) {
          const found = await storage.findById(criteria.id as string);
          return (found ?? null) as never;
        }
        const found = await storage.findBy(criteria);
        return (found ?? null) as never;
      },

      findMany: async ({
        model,
        where,
        limit,
        offset,
        sortBy,
      }: {
        model: string;
        where?: CleanedWhere[];
        limit: number;
        offset?: number;
        sortBy?: { field: string; direction: 'asc' | 'desc' };
      }) => {
        const storage = storageOf(storageMap, model);
        if (where && where.length > 0) {
          const criteria = whereToCriteria(where);
          const rows = await storage.findAllBy(criteria);
          return applyClientSidePagination(rows, sortBy, offset, limit) as never;
        }
        const rows = await storage.list({
          limit,
          offset,
          orderBy: sortBy?.field,
          order: sortBy?.direction,
        });
        return rows as never;
      },

      count: async ({ model, where }: { model: string; where?: CleanedWhere[] }) => {
        const storage = storageOf(storageMap, model);
        if (where && where.length > 0) {
          const criteria = whereToCriteria(where);
          const rows = await storage.findAllBy(criteria);
          return rows.length;
        }
        const rows = await storage.list({ count: true });
        return rows.total ?? rows.length;
      },

      update: async <T>({ model, where, update }: { model: string; where: CleanedWhere[]; update: T }): Promise<T | null> => {
        const storage = storageOf(storageMap, model);
        const criteria = whereToCriteria(where);
        const target = 'id' in criteria
          ? await storage.findById(criteria.id as string)
          : await storage.findBy(criteria);
        if (!target) return null;
        return (await storage.update(target.id as string, update as Partial<Record<string, unknown>>)) as T;
      },

      updateMany: async ({ model, where, update }: { model: string; where: CleanedWhere[]; update: Record<string, unknown> }) => {
        const storage = storageOf(storageMap, model);
        const criteria = whereToCriteria(where);
        const targets = await storage.findAllBy(criteria);
        for (const target of targets) await storage.update(target.id as string, update);
        return targets.length;
      },

      delete: async ({ model, where }: { model: string; where: CleanedWhere[] }) => {
        const storage = storageOf(storageMap, model);
        const criteria = whereToCriteria(where);
        const target = 'id' in criteria
          ? await storage.findById(criteria.id as string)
          : await storage.findBy(criteria);
        if (target) await storage.delete(target.id as string);
      },

      deleteMany: async ({ model, where }: { model: string; where: CleanedWhere[] }) => {
        const storage = storageOf(storageMap, model);
        const criteria = whereToCriteria(where);
        const targets = await storage.findAllBy(criteria);
        for (const target of targets) await storage.delete(target.id as string);
        return targets.length;
      },
    }),
  });
}

/**
 * Augmented Storage shape — the core interface doesn't expose findBy/findAllBy
 * but SqlStorage (the only impl today) does. Cast locally to use them.
 */
/**
 * Storage.findAllBy doesn't expose pagination/sort, so we apply them in JS
 * after fetching the eq-filtered rows. Fine for auth volumes (orgs/sessions/accounts).
 */
function applyClientSidePagination(
  rows: Record<string, unknown>[],
  sortBy?: { field: string; direction: 'asc' | 'desc' },
  offset?: number,
  limit?: number,
): Record<string, unknown>[] {
  let result = rows;
  if (sortBy) {
    const { field, direction } = sortBy;
    result = [...result].sort((a, b) => {
      const av = a[field], bv = b[field];
      if (av == null && bv == null) return 0;
      if (av == null) return -1;
      if (bv == null) return 1;
      const cmp = av < bv ? -1 : av > bv ? 1 : 0;
      return direction === 'desc' ? -cmp : cmp;
    });
  }
  if (offset !== undefined) result = result.slice(offset);
  if (limit !== undefined) result = result.slice(0, limit);
  return result;
}
