'use client';
/**
 * The couple — useQuery (reads) and useCommand (writes), the two dual gestures of a page talking
 * to a Frond, in Vue.
 */
import { useCallback, useEffect, useState } from 'react';
import type { FougereError } from '@fougere/core/contract';
import {
  asFougereError,
  callOf,
  entityKeyOf,
  invocationOf,
  itemsOf,
  mountedKeys,
  pageOf,
  queryKeyOf,
  sendCall,
  trackQuery,
  type CallInput,
  type EntityClass,
} from '@fougere/app/client';
import { fetcher, onRefetch, revalidate } from './transport.js';

export function useQuery<T = Record<string, unknown>>(
  entity: EntityClass,
  op: string,
  input?: CallInput,
  opts?: { immediate?: boolean },
) {
  const entityKey = entityKeyOf(entity);
  // The key IS the dependency: an input literal is a new object on every render, so
  // depending on it directly would refetch forever. Its serialization is stable.
  const key = queryKeyOf(entityKey, op, input);
  const immediate = opts?.immediate !== false;

  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(immediate);
  const [error, setError] = useState<FougereError | null>(null);

  const refresh = useCallback(async (): Promise<void> => {
    setLoading(true);
    setError(null);
    try {
      setData((await sendCall(fetcher, callOf(entity, op), invocationOf(input))) as T);
    } catch (err) {
      setError(asFougereError(err, entityKey, op));
    } finally {
      setLoading(false);
    }
    // `key` stands for (entity, op, input) — see above.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  useEffect(() => {
    const untrack = trackQuery(entityKey, key);
    const off = onRefetch(key, () => void refresh());
    if (immediate) void refresh();
    return () => {
      untrack();
      off();
    };
  }, [entityKey, key, immediate, refresh]);

  return {
    data,
    items: itemsOf<T>(data),
    total: pageOf(data).total,
    hasMore: pageOf(data).hasMore,
    loading,
    error,
    refresh,
  };
}

export function useCommand<T = unknown>(entity: EntityClass, op: string) {
  const entityKey = entityKeyOf(entity);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<FougereError | null>(null);

  const execute = useCallback(
    async (input?: CallInput): Promise<T> => {
      setLoading(true);
      setError(null);
      try {
        const result = (await sendCall(fetcher, callOf(entity, op), invocationOf(input))) as T;
        // The link: same entity designated on both sides → revalidate its queries.
        revalidate(mountedKeys(entityKey));
        return result;
      } catch (err) {
        const failure = asFougereError(err, entityKey, op);
        setError(failure);
        throw failure;
      } finally {
        setLoading(false);
      }
      // eslint-disable-next-line react-hooks/exhaustive-deps
    },
    [entityKey, op],
  );

  return { execute, loading, error };
}
