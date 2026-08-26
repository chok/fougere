import { createAdapterFactory } from 'better-auth/adapters';
import type { CleanedWhere, CustomAdapter } from 'better-auth/adapters';
import type { EntityOrm } from '@fougere/core';

/**
 * Map of better-auth model names ('user', 'session', 'account', ...)
 * to Fougere EntityOrm instances. Built once at boot by create() in index.ts.
 */
export type OrmMap = Map<string, EntityOrm>;

/**
 * Where[] supported subset:
 * - All clauses use 'eq' operator
 * - Implicit AND between clauses (no OR connector)
 * Anything else throws — extend EntityOrm or add an engine-level fallback when needed.
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

function getOrm(ormMap: OrmMap, model: string): EntityOrm {
  const orm = ormMap.get(model);
  if (!orm) {
    throw new Error(
      `[fougereAdapter] Unknown model '${model}'. ` +
      `Known models: ${[...ormMap.keys()].join(', ')}. ` +
      `Plugins that ship their own schema need entities registered explicitly.`,
    );
  }
  return orm;
}

/**
 * Better-auth adapter that routes every operation through Fougere EntityOrm.
 *
 * This closes the loop: the same `db` resolved by Fougere's bootstrap is the
 * one EntityOrm writes to, and better-auth never touches the storage directly.
 * If Fougere swaps Kysely for another backend, this adapter follows for free.
 */
export function fougereAdapter(ormMap: OrmMap) {
  return createAdapterFactory({
    config: {
      adapterId: 'fougere',
      adapterName: 'Fougere Adapter',
      usePlural: false,
      supportsArrays: false,
      supportsJSON: false,
      // The ORM converts both ways now (`schema-sql/src/values.ts`), so better-auth
      // can hand over the Dates and booleans its own types declare.
      supportsDates: true,
      supportsBooleans: true,
    },
    adapter: (): CustomAdapter => ({
      create: async ({ model, data }: { model: string; data: Record<string, unknown> }) => {
        const orm = getOrm(ormMap, model);
        return (await orm.create(data)) as never;
      },

      findOne: async ({ model, where }: { model: string; where: CleanedWhere[] }) => {
        const orm = getOrm(ormMap, model);
        const criteria = whereToCriteria(where);
        if (Object.keys(criteria).length === 1 && 'id' in criteria) {
          const found = await orm.findById(criteria.id as string);
          return (found ?? null) as never;
        }
        const found = await orm.findBy(criteria);
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
        const orm = getOrm(ormMap, model);
        if (where && where.length > 0) {
          const criteria = whereToCriteria(where);
          const rows = await orm.findAllBy(criteria);
          return applyClientSidePagination(rows, sortBy, offset, limit) as never;
        }
        const rows = await orm.list({
          limit,
          offset,
          orderBy: sortBy?.field,
          order: sortBy?.direction,
        });
        return rows as never;
      },

      count: async ({ model, where }: { model: string; where?: CleanedWhere[] }) => {
        const orm = getOrm(ormMap, model);
        if (where && where.length > 0) {
          const criteria = whereToCriteria(where);
          const rows = await orm.findAllBy(criteria);
          return rows.length;
        }
        const rows = await orm.list({ count: true });
        return rows.total ?? rows.length;
      },

      update: async <T>({ model, where, update }: { model: string; where: CleanedWhere[]; update: T }): Promise<T | null> => {
        const orm = getOrm(ormMap, model);
        const criteria = whereToCriteria(where);
        const target = 'id' in criteria
          ? await orm.findById(criteria.id as string)
          : await orm.findBy(criteria);
        if (!target) return null;
        return (await orm.update(target.id as string, update as Partial<Record<string, unknown>>)) as T;
      },

      updateMany: async ({ model, where, update }: { model: string; where: CleanedWhere[]; update: Record<string, unknown> }) => {
        const orm = getOrm(ormMap, model);
        const criteria = whereToCriteria(where);
        const targets = await orm.findAllBy(criteria);
        await Promise.all(targets.map((t) => orm.update(t.id as string, update)));
        return targets.length;
      },

      delete: async ({ model, where }: { model: string; where: CleanedWhere[] }) => {
        const orm = getOrm(ormMap, model);
        const criteria = whereToCriteria(where);
        const target = 'id' in criteria
          ? await orm.findById(criteria.id as string)
          : await orm.findBy(criteria);
        if (target) await orm.delete(target.id as string);
      },

      deleteMany: async ({ model, where }: { model: string; where: CleanedWhere[] }) => {
        const orm = getOrm(ormMap, model);
        const criteria = whereToCriteria(where);
        const targets = await orm.findAllBy(criteria);
        await Promise.all(targets.map((t) => orm.delete(t.id as string)));
        return targets.length;
      },
    }),
  });
}

/**
 * Augmented EntityOrm shape — the core interface doesn't expose findBy/findAllBy
 * but SqlEntityOrm (the only impl today) does. Cast locally to use them.
 */
/**
 * EntityOrm.findAllBy doesn't expose pagination/sort, so we apply them in JS
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
