/** The couple — useQuery (reads) and useCommand (writes), in Svelte. */
import { writable, get, type Readable } from 'svelte/store';
import type { FougereError } from '@fougere/core/contract';
import {
  asFougereError,
  callOf,
  entityKeyOf,
  fetcher,
  invocationOf,
  itemsOf,
  mountedKeys,
  onRefetch,
  pageOf,
  queryKeyOf,
  revalidate,
  sendCall,
  trackQuery,
  type CallInput,
  type EntityClass,
} from '@fougere/app/client';

export interface QueryState<T> {
  data: T | null;
  items: T[];
  total?: number;
  hasMore?: boolean;
  loading: boolean;
  error: FougereError | null;
}

export interface QueryStore<T> extends Readable<QueryState<T>> {
  refresh(): Promise<void>;
  /** Unregister from the link. Call it from `onDestroy` when a component unmounts. */
  dispose(): void;
}

export function useQuery<T = Record<string, unknown>>(
  entity: EntityClass,
  op: string,
  input?: CallInput,
  opts?: { immediate?: boolean },
): QueryStore<T> {
  const entityKey = entityKeyOf(entity);
  const key = queryKeyOf(entityKey, op, input);
  const immediate = opts?.immediate !== false;

  const store = writable<QueryState<T>>({
    data: null,
    items: [],
    loading: immediate,
    error: null,
  });

  async function refresh(): Promise<void> {
    store.update((state) => ({ ...state, loading: true, error: null }));
    try {
      const data = (await sendCall(fetcher, callOf(entity, op), invocationOf(input))) as T;
      const page = pageOf(data);
      store.set({ data, items: itemsOf<T>(data), total: page.total, hasMore: page.hasMore, loading: false, error: null });
    } catch (err) {
      store.update((state) => ({ ...state, loading: false, error: asFougereError(err, entityKey, op) }));
    }
  }

  const untrack = trackQuery(entityKey, key);
  const off = onRefetch(key, () => void refresh());
  if (immediate) void refresh();

  return {
    subscribe: store.subscribe,
    refresh,
    dispose() {
      untrack();
      off();
    },
  };
}

export interface CommandStore<T> extends Readable<{ loading: boolean; error: FougereError | null }> {
  execute(input?: CallInput): Promise<T>;
}

export function useCommand<T = unknown>(entity: EntityClass, op: string): CommandStore<T> {
  const entityKey = entityKeyOf(entity);
  const store = writable<{ loading: boolean; error: FougereError | null }>({ loading: false, error: null });

  return {
    subscribe: store.subscribe,
    async execute(input?: CallInput): Promise<T> {
      store.set({ loading: true, error: null });
      try {
        const result = (await sendCall(fetcher, callOf(entity, op), invocationOf(input))) as T;
        // The link: same entity designated on both sides → revalidate its queries.
        revalidate(mountedKeys(entityKey));
        store.set({ loading: false, error: null });
        return result;
      } catch (err) {
        const failure = asFougereError(err, entityKey, op);
        store.set({ loading: false, error: failure });
        throw failure;
      }
    },
  };
}

/** Read a store's current value without subscribing — used by `useFormFor`. */
export { get };
