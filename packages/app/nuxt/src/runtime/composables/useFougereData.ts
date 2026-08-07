/**
 * The couple — useQuery (reads) and useCommand (writes), the two dual
 * gestures of a page talking to a Frond. Designation is class + verb:
 * the imported entity class carries the metadata, its name carries the
 * registration key.
 *
 * Both gestures ride the call envelope: the browser POSTs JSON-RPC to
 * /_fougere/call; during SSR Nuxt collapses the same call to an
 * in-process fetch (no network, no port).
 *
 * The link: a successful command on an entity revalidates every mounted
 * query on that entity — designation gives the entity on both sides,
 * nothing to declare.
 */
import { useAsyncData, useRequestFetch, refreshNuxtData } from '#imports';
import { ref, computed, toValue, onScopeDispose, type MaybeRefOrGetter, type Ref } from 'vue';
import {
  FougereError,
  ErrorCode,
  toRegistrationName,
  type InvocationContext,
  type FrondCall,
} from '@fougere/core/contract';
import { frameCall, unframeResponse, type RpcResponse } from '@fougere/transport-http/client';

/** An entity class is a designation: its name is the registration key. */
type EntityClass = { name: string };

/** What a page provides of an invocation — the rest is stamped server-side. */
export type CallInput = Partial<Pick<InvocationContext, 'params' | 'query' | 'body'>>;

let nextId = 1;

/** Mounted queries per entity — the command side of the link reads this. */
const mounted = new Map<string, Set<string>>();

function invocationOf(input?: CallInput): InvocationContext {
  return { params: {}, query: {}, body: undefined, state: {}, ...input };
}

type Fetcher = <T>(url: string, options: { method: 'POST'; body: unknown }) => Promise<T>;

async function send(fetcher: Fetcher, call: FrondCall, invocation: InvocationContext): Promise<unknown> {
  const response = await fetcher<RpcResponse>('/_fougere/call', {
    method: 'POST',
    body: frameCall(call, invocation, nextId++),
  });
  return unframeResponse(response, call);
}

export async function useQuery<T = Record<string, unknown>>(
  entity: EntityClass,
  op: string,
  input?: MaybeRefOrGetter<CallInput | undefined>,
  opts?: { immediate?: boolean },
) {
  const entityKey = toRegistrationName(entity.name);
  const call: FrondCall = { entity: entityKey, op };
  const key = `fougere:${entityKey}.${op}:${JSON.stringify(toValue(input) ?? {})}`;
  const fetcher = useRequestFetch() as Fetcher;

  // Register before any await — the link and scope cleanup need the setup scope.
  if (import.meta.client) {
    const keys = mounted.get(entityKey) ?? new Set<string>();
    keys.add(key);
    mounted.set(entityKey, keys);
    onScopeDispose(() => keys.delete(key));
  }

  const { data, pending, error, refresh } = await useAsyncData(
    key,
    () => send(fetcher, call, invocationOf(toValue(input))),
    {
      ...(input === undefined ? {} : { watch: [() => toValue(input)] }),
      ...(opts?.immediate === false ? { immediate: false } : {}),
    },
  );

  // A list result reads as items/total/hasMore whatever the wire delivered.
  const items = computed<T[]>(() => {
    const v = data.value as unknown;
    if (Array.isArray(v)) return v as T[];
    if (v && typeof v === 'object' && Array.isArray((v as { items?: unknown }).items)) {
      return (v as { items: T[] }).items;
    }
    return [];
  });
  const total = computed(() => (data.value as { total?: number } | null)?.total);
  const hasMore = computed(() => (data.value as { hasMore?: boolean } | null)?.hasMore);

  return { data: data as Ref<T | null>, items, total, hasMore, loading: pending, error, refresh };
}

export function useCommand<T = unknown>(entity: EntityClass, op: string) {
  const entityKey = toRegistrationName(entity.name);
  const call: FrondCall = { entity: entityKey, op };
  const fetcher = useRequestFetch() as Fetcher;
  const loading = ref(false);
  const error = ref<FougereError | null>(null);

  async function execute(input?: CallInput): Promise<T> {
    loading.value = true;
    error.value = null;
    try {
      const result = (await send(fetcher, call, invocationOf(input))) as T;
      // The link: same entity designated on both sides → revalidate its queries.
      const keys = mounted.get(entityKey);
      if (keys?.size) await refreshNuxtData([...keys]);
      return result;
    } catch (err) {
      error.value =
        err instanceof FougereError
          ? err
          : new FougereError({
              code: ErrorCode.SERVICE_UNAVAILABLE,
              message: (err as Error)?.message ?? String(err),
              entity: entityKey,
              operation: op,
              cause: err,
            });
      throw error.value;
    } finally {
      loading.value = false;
    }
  }

  return { execute, loading, error };
}
