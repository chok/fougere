/** react-admin's `DataProvider`, answered by the Fougere wire. */
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
  /** The field that identifies a row. */
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

/** A refusal, in the shape react-admin reads. */
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
    /** One page, and how it knows there is another. */
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

    /** N calls, and the reason is upstream: */
    getMany: async (resource: string, params: { ids: (string | number)[] }) => {
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

    /** The bulk pair, one call per row. */
    updateMany: async (resource: string, params: { ids: (string | number)[]; data: Row }) => {
      const key = keyOf(resource);
      await Promise.all(params.ids.map((id) => call(resource, 'update', {
        params: { id }, body: deidentified(params.data, key),
      })));
      return { data: params.ids };
    },

    deleteMany: async (resource: string, params: { ids: (string | number)[] }) => {
      await Promise.all(params.ids.map((id) => call(resource, 'delete', { params: { id } })));
      return { data: params.ids };
    },

    /** A tenth method, because the other nine are CRUD and a Frond is not. */
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

/** The card arrives asynchronously; react-admin requires a provider synchronously. */
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
