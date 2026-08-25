/**
 * react-admin's `DataProvider`, answered by the Fougere wire.
 *
 * Nine functions, and every one of them had a counterpart already: `getList` is
 * `ListOptions`, `getManyReference` is the ORM's `findAllByKeys` (written for a
 * presenter that wanted "the items of these lists"), `filter` is `where` — an
 * equality map that already refuses an unknown key, because a filter silently
 * dropped had once returned the whole table.
 *
 * It talks to the FAÇADE and never to an ORM, which is not a precaution here but a
 * consequence: this runs in a browser, and the only thing a browser can reach is the
 * call endpoint. Judges, presenters and middlewares are therefore on the path of
 * every read and every write the back-office makes.
 */
import {
  sendCall,
  fetcher as browserFetcher,
  CALL_ENDPOINT,
  itemsOf,
  pageOf,
  errorsByField,
  type Fetcher,
} from '@fougere/app/client';
import { validationErrorsOf } from '@fougere/core/contract';

/** What a resource must tell the provider — the rest of the card is the UI's business. */
export interface ResourceKey {
  /** The registration key its door answers under — `post`, not `Post`. */
  name: string;
  /**
   * The field that identifies a row. react-admin insists on `id`; an entity does not,
   * so the provider renames it on the way out and back. `FieldSet.primary` reads it off
   * the card, and answers `undefined` rather than defaulting — a shape with no primary
   * has no row identity to invent.
   */
  primary: string;
}

export interface ProviderOptions {
  /** Registration key → its identity. Built from the card by `resourcesOf`. */
  resources: Record<string, ResourceKey>;
  /** The call endpoint. A named surface appends `/{surface}` to it. */
  endpoint?: string;
  fetcher?: Fetcher;
}

type Row = Record<string, unknown>;

/**
 * A refusal, in the shape react-admin reads.
 *
 * `body.errors` keyed by field is what its forms display; `errorsByField` already
 * produces exactly that, and is the same function the Vue and React form primitives
 * use — so a field is highlighted identically whichever door the page came through.
 * A non-validation failure passes through untouched: it is not a form's business.
 */
function asAdminError(err: unknown): unknown {
  const refusals = validationErrorsOf(err);
  if (!refusals) return err;
  return Object.assign(new Error((err as Error).message), {
    status: 400,
    body: { errors: errorsByField(refusals) },
  });
}

export function createDataProvider(options: ProviderOptions) {
  const { resources, endpoint = CALL_ENDPOINT, fetcher = browserFetcher } = options;

  const keyOf = (resource: string): ResourceKey => {
    const known = resources[resource];
    if (!known) throw new Error(`Unknown resource '${resource}' — the card names none of that address`);
    return known;
  };

  const call = async (resource: string, op: string, input: Record<string, unknown>): Promise<unknown> => {
    try {
      return await sendCall(fetcher, { entity: resource, op }, {
        params: {}, query: {}, body: undefined, state: {}, ...input,
      }, endpoint);
    } catch (err) {
      throw asAdminError(err);
    }
  };

  /** The row as react-admin needs it: whatever identifies it, under `id`. */
  const identified = (row: Row | undefined, key: ResourceKey): Row | undefined =>
    row === undefined || key.primary === 'id' ? row : { ...row, id: row[key.primary] };

  /** Its dual — what leaves for the server carries the entity's own field name. */
  const deidentified = (data: Row, key: ResourceKey): Row => {
    if (key.primary === 'id') return data;
    const { id, ...rest } = data;
    return id === undefined ? rest : { ...rest, [key.primary]: id };
  };

  const list = async (
    resource: string,
    query: Record<string, unknown>,
  ): Promise<{ data: Row[]; total?: number }> => {
    const key = keyOf(resource);
    const answer = await call(resource, 'list', { query });
    return {
      data: itemsOf<Row>(answer).map((row) => identified(row, key)!),
      total: pageOf(answer).total,
    };
  };

  return {
    /**
     * One page, and how it knows there is another.
     *
     * `count: true` is asked for and read when it arrives — but `ListResult` extends
     * `Array`, so `JSON.stringify` drops its `total` and nothing wraps a `page`
     * result today. The same handler therefore answers a total in-process and none
     * over the wire. Rather than depend on it, the page is fetched one row longer
     * than asked: the surplus row IS the answer to "is there a next page", which is
     * `pageInfo`, a form react-admin accepts in place of a total.
     */
    getList: async (resource: string, params: {
      pagination?: { page: number; perPage: number };
      sort?: { field: string; order: string };
      filter?: Record<string, unknown>;
    }) => {
      const { page = 1, perPage = 25 } = params.pagination ?? {};
      const { data, total } = await list(resource, {
        limit: perPage + 1,
        offset: (page - 1) * perPage,
        count: true,
        ...(params.sort?.field
          ? { orderBy: params.sort.field, order: params.sort.order?.toLowerCase() }
          : {}),
        ...(params.filter && Object.keys(params.filter).length ? { where: params.filter } : {}),
      });
      const hasNextPage = data.length > perPage;
      return {
        data: hasNextPage ? data.slice(0, perPage) : data,
        ...(total !== undefined ? { total } : {}),
        pageInfo: { hasNextPage, hasPreviousPage: page > 1 },
      };
    },

    getOne: async (resource: string, params: { id: string | number }) => {
      const key = keyOf(resource);
      const row = identified((await call(resource, 'findById', { params: { id: params.id } })) as Row, key);
      if (!row) throw Object.assign(new Error(`${resource} ${params.id} not found`), { status: 404 });
      return { data: row };
    },

    /**
     * N calls, and the reason is upstream: `findByKeys` is a gesture of the ORM port,
     * not one of `Crud`'s five ops, so there is no door to ask for several rows by id.
     * Said here rather than hidden — the day `Crud` names that op this becomes one call.
     */
    getMany: async (resource: string, params: { ids: Array<string | number> }) => {
      const key = keyOf(resource);
      const rows = await Promise.all(
        params.ids.map((id) => call(resource, 'findById', { params: { id } })),
      );
      return { data: rows.map((row) => identified(row as Row, key)).filter((row): row is Row => !!row) };
    },

    /** The rows pointing AT one — an equality filter, which `where` already is. */
    getManyReference: async (resource: string, params: {
      target: string;
      id: string | number;
      pagination?: { page: number; perPage: number };
      sort?: { field: string; order: string };
      filter?: Record<string, unknown>;
    }) => {
      const { page = 1, perPage = 25 } = params.pagination ?? {};
      return list(resource, {
        limit: perPage,
        offset: (page - 1) * perPage,
        count: true,
        where: { ...params.filter, [params.target]: params.id },
        ...(params.sort?.field
          ? { orderBy: params.sort.field, order: params.sort.order?.toLowerCase() }
          : {}),
      });
    },

    create: async (resource: string, params: { data: Row }) => {
      const key = keyOf(resource);
      const row = await call(resource, 'create', { body: deidentified(params.data, key) });
      return { data: identified(row as Row, key)! };
    },

    update: async (resource: string, params: { id: string | number; data: Row }) => {
      const key = keyOf(resource);
      const row = await call(resource, 'update', {
        params: { id: params.id },
        body: deidentified(params.data, key),
      });
      return { data: identified(row as Row, key)! };
    },

    delete: async (resource: string, params: { id: string | number; previousData?: Row }) => {
      await call(resource, 'delete', { params: { id: params.id } });
      return { data: (params.previousData ?? { id: params.id }) as Row };
    },

    /**
     * The bulk pair, one call per row.
     *
     * `Together<[…]>` would make them one unit of work — but it is a port a HANDLER
     * asks for, and this is a browser. Making these atomic means naming an operation
     * in the frond that says so, which is the app's sentence to write, not ours.
     */
    updateMany: async (resource: string, params: { ids: Array<string | number>; data: Row }) => {
      const key = keyOf(resource);
      await Promise.all(params.ids.map((id) => call(resource, 'update', {
        params: { id }, body: deidentified(params.data, key),
      })));
      return { data: params.ids };
    },

    deleteMany: async (resource: string, params: { ids: Array<string | number> }) => {
      await Promise.all(params.ids.map((id) => call(resource, 'delete', { params: { id } })));
      return { data: params.ids };
    },

    /**
     * A tenth method, because the other nine are CRUD and a Frond is not.
     *
     * react-admin's verbs describe a RESOURCE; `publish` describes an ACTION, and none of
     * the nine can carry it. `DataProvider` has an index signature for exactly this case.
     *
     * **The id rides in `params`, and that is an assumption.** The card states an op's
     * input SCHEMA and never its binding plan — `computeBindingPlan` lives in the boot and
     * does not travel — so a button derived from a card must guess where each argument is
     * read from, and it guesses the CRUD convention. True of every op the scan derives
     * today; the honest fix is upstream, making the binding ride in `CardOp`.
     */
    invoke: async (
      resource: string,
      params: { op: string; id?: string | number; data?: Row },
    ): Promise<{ data: unknown }> => ({
      data: await call(resource, params.op, {
        ...(params.id !== undefined ? { params: { id: String(params.id) } } : {}),
        ...(params.data !== undefined ? { body: params.data } : {}),
      }),
    }),
  };
}

export type FougereDataProvider = ReturnType<typeof createDataProvider>;

/**
 * The card arrives asynchronously; react-admin requires a provider synchronously.
 *
 * Spell the nine delegates instead of hiding them behind a Proxy. Apart from being
 * inspectable and type-checked, this survives object spreading — the prototype used a
 * Proxy and then spread it into `{}`, which enumerated no methods and handed react-admin
 * an empty provider.
 */
export function createLazyDataProvider(load: () => Promise<FougereDataProvider>): FougereDataProvider {
  return {
    getList: async (...args) => (await load()).getList(...args),
    getOne: async (...args) => (await load()).getOne(...args),
    getMany: async (...args) => (await load()).getMany(...args),
    getManyReference: async (...args) => (await load()).getManyReference(...args),
    create: async (...args) => (await load()).create(...args),
    update: async (...args) => (await load()).update(...args),
    delete: async (...args) => (await load()).delete(...args),
    updateMany: async (...args) => (await load()).updateMany(...args),
    deleteMany: async (...args) => (await load()).deleteMany(...args),
    invoke: async (...args) => (await load()).invoke(...args),
  };
}
