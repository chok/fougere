import { useAsyncData, useRequestFetch, refreshNuxtData } from '#imports';
import { ref, computed, toValue, onScopeDispose, type MaybeRefOrGetter } from 'vue';
import type { FougereError } from '@fougere/core/contract';
import {
  callOf,
  addressOf,
  invocationOf,
  queryKeyOf,
  sendCall,
  trackQuery,
  mountedKeys,
  itemsOf,
  pageOf,
  asFougereError,
  type CallInput,
  type Answer,
  type Refused,
  type FacadeName,
  type Rows,
  type Fetcher,
} from '@fougere/app/client';

export type { CallInput };

export async function useQuery<
  Handler,
  Address extends string,
  Op extends keyof Handler & string,
>(
  facade: FacadeName<Handler, Address>,
  op: Op,
  input?: MaybeRefOrGetter<CallInput | undefined>,
  opts?: { immediate?: boolean },
) {
  type Answered = Answer<Handler, Op>;
  const entityKey = addressOf(facade);
  const call = callOf(facade, op);
  const key = queryKeyOf(entityKey, op, toValue(input));
  const fetcher = useRequestFetch() as Fetcher;

  if (import.meta.client) {
    onScopeDispose(trackQuery(entityKey, key));
  }

  const { data, pending, error, refresh } = await useAsyncData(
    key,
    () => sendCall(fetcher, call, invocationOf(toValue(input))) as Promise<Answered>,
    {
      default: () => null,
      ...(input === undefined ? {} : { watch: [() => toValue(input)] }),
      ...(opts?.immediate === false ? { immediate: false } : {}),
    },
  );

  const items = computed<Rows<Answered>[]>(() => itemsOf<Rows<Answered>>(data.value));
  const total = computed(() => pageOf(data.value).total);
  const hasMore = computed(() => pageOf(data.value).hasMore);

  return {
    data,
    items,
    total,
    hasMore,
    loading: pending,
    error,
    refresh: refresh as () => Promise<void>,
  };
}

export function useCommand<
  Handler,
  Address extends string,
  Op extends keyof Handler & string,
>(facade: FacadeName<Handler, Address>, op: Op) {
  type Answered = Answer<Handler, Op>;
  const entityKey = addressOf(facade);
  const call = callOf(facade, op);
  const fetcher = useRequestFetch() as Fetcher;
  const loading = ref(false);
  const error = ref<FougereError<Refused<Address, Op>> | null>(null);

  async function execute(input?: CallInput): Promise<Answered | null> {
    loading.value = true;
    error.value = null;
    try {
      const result = (await sendCall(fetcher, call, invocationOf(input))) as Answered;
      const keys = mountedKeys(entityKey);
      if (keys.length) await refreshNuxtData(keys);

      return result;
    } catch (err) {
      error.value = asFougereError(err, entityKey, op) as FougereError<Refused<Address, Op>>;

      return null;
    } finally {
      loading.value = false;
    }
  }

  return { execute, loading, error };
}
