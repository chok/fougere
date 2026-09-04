/**
 * The couple — useQuery (reads) and useCommand (writes), the two dual gestures of a page talking
 * to a Frond, in Vue.
 */
import { useAsyncData, useRequestFetch, refreshNuxtData } from '#imports';
import { ref, computed, toValue, onScopeDispose, type MaybeRefOrGetter, type Ref } from 'vue';
import type { FougereError } from '@fougere/core/contract';
import {
  callOf,
  entityKeyOf,
  invocationOf,
  queryKeyOf,
  sendCall,
  trackQuery,
  mountedKeys,
  itemsOf,
  pageOf,
  asFougereError,
  type CallInput,
  type EntityClass,
  type Fetcher,
} from '@fougere/app/client';

export type { CallInput };

export async function useQuery<T = Record<string, unknown>>(
  entity: EntityClass,
  op: string,
  input?: MaybeRefOrGetter<CallInput | undefined>,
  opts?: { immediate?: boolean },
) {
  const entityKey = entityKeyOf(entity);
  const call = callOf(entity, op);
  const key = queryKeyOf(entityKey, op, toValue(input));
  const fetcher = useRequestFetch() as Fetcher;

  // Register before any await — the link and scope cleanup need the setup scope.
  if (import.meta.client) {
    onScopeDispose(trackQuery(entityKey, key));
  }

  const { data, pending, error, refresh } = await useAsyncData(
    key,
    () => sendCall(fetcher, call, invocationOf(toValue(input))),
    {
      ...(input === undefined ? {} : { watch: [() => toValue(input)] }),
      ...(opts?.immediate === false ? { immediate: false } : {}),
    },
  );

  const items = computed<T[]>(() => itemsOf<T>(data.value));
  const total = computed(() => pageOf(data.value).total);
  const hasMore = computed(() => pageOf(data.value).hasMore);

  return {
    data: data as Ref<T | null>,
    items,
    total,
    hasMore,
    loading: pending,
    error,
    // Nuxt does not export AsyncDataExecuteOptions, so the inferred signature cannot
    // be named from outside; callers pass nothing.
    refresh: refresh as () => Promise<void>,
  };
}

export function useCommand<T = unknown>(entity: EntityClass, op: string) {
  const entityKey = entityKeyOf(entity);
  const call = callOf(entity, op);
  const fetcher = useRequestFetch() as Fetcher;
  const loading = ref(false);
  const error = ref<FougereError | null>(null);

  async function execute(input?: CallInput): Promise<T> {
    loading.value = true;
    error.value = null;
    try {
      const result = (await sendCall(fetcher, call, invocationOf(input))) as T;
      // The link: same entity designated on both sides → revalidate its queries.
      const keys = mountedKeys(entityKey);
      if (keys.length) await refreshNuxtData(keys);
      return result;
    } catch (err) {
      error.value = asFougereError(err, entityKey, op);
      throw error.value;
    } finally {
      loading.value = false;
    }
  }

  return { execute, loading, error };
}
