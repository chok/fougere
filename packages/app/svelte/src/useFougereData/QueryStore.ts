import { writable, type Readable } from 'svelte/store';
import { asFougereError, callOf, addressOf, fetcher, invocationOf, itemsOf, onRefetch, pageOf, queryKeyOf, sendCall, trackQuery, type CallInput, type Answer, type FacadeName, type Rows } from '@fougere/app/client';
import type { QueryState } from './QueryState.js';

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
