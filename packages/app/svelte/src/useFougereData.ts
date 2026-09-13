/** The couple — useQuery (reads) and useCommand (writes), in Svelte. */
import { writable, get, type Readable } from 'svelte/store';
import type { ErrorCode, FougereError } from '@fougere/core/contract';
import {
  asFougereError,
  callOf,
  addressOf,
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
  type Answer,
  type Refused,
  type FacadeName,
  type Rows,
} from '@fougere/app/client';

export interface QueryState<Answered> {
  data: Answered | null;
  items: Rows<Answered>[];
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

export function useQuery<
  Handler,
  Address extends string,
  Op extends keyof Handler & string,
>(
  facade: FacadeName<Handler, Address>,
  op: Op,
  input?: CallInput,
  opts?: { immediate?: boolean },
): QueryStore<Answer<Handler, Op>> {
  const entityKey = addressOf(facade);
  const key = queryKeyOf(entityKey, op, input);
  const immediate = opts?.immediate !== false;

  const store = writable<QueryState<Answer<Handler, Op>>>({
    data: null,
    items: [],
    loading: immediate,
    error: null,
  });

  async function refresh(): Promise<void> {
    store.update((state) => ({ ...state, loading: true, error: null }));
    try {
      const data = (await sendCall(fetcher, callOf(facade, op), invocationOf(input))) as Answer<Handler, Op>;
      const page = pageOf(data);
      store.set({ data, items: itemsOf<Rows<Answer<Handler, Op>>>(data), total: page.total, hasMore: page.hasMore, loading: false, error: null });
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

export interface CommandStore<T, Refused extends ErrorCode = ErrorCode>
  extends Readable<{ loading: boolean; error: FougereError<Refused> | null }> {
  execute(input?: CallInput): Promise<T>;
}

export function useCommand<
  Handler,
  Address extends string,
  Op extends keyof Handler & string,
>(facade: FacadeName<Handler, Address>, op: Op): CommandStore<Answer<Handler, Op>, Refused<Address, Op>> {
  const entityKey = addressOf(facade);
  const store = writable<{ loading: boolean; error: FougereError | null }>({ loading: false, error: null });

  return {
    subscribe: store.subscribe,
    async execute(input?: CallInput): Promise<Answer<Handler, Op>> {
      store.set({ loading: true, error: null });
      try {
        const result = (await sendCall(fetcher, callOf(facade, op), invocationOf(input))) as Answer<Handler, Op>;
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
