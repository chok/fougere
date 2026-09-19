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
  addressOf,
  invocationOf,
  itemsOf,
  mountedKeys,
  pageOf,
  queryKeyOf,
  sendCall,
  trackQuery,
  type CallInput,
  type Answer,
  type Refused,
  type FacadeName,
  type Rows,
} from '@fougere/app/client';
import { fetcher, onRefetch, revalidate } from './transport.js';

export function useQuery<
  Handler,
  Address extends string,
  Op extends keyof Handler & string,
>(
  facade: FacadeName<Handler, Address>,
  op: Op,
  input?: CallInput,
  opts?: { immediate?: boolean },
) {
  type Answered = Answer<Handler, Op>;
  const entityKey = addressOf(facade);
  // The key IS the dependency: an input literal is a new object on every render, so
  // depending on it directly would refetch forever. Its serialization is stable.
  const key = queryKeyOf(entityKey, op, input);
  const immediate = opts?.immediate !== false;

  const [data, setData] = useState<Answered | null>(null);
  const [loading, setLoading] = useState(immediate);
  const [error, setError] = useState<FougereError<Refused<Address, Op>> | null>(null);

  const refresh = useCallback(async (): Promise<void> => {
    setLoading(true);
    setError(null);
    try {
      setData((await sendCall(fetcher, callOf(facade, op), invocationOf(input))) as Answered);
    } catch (err) {
      setError(asFougereError(err, entityKey, op) as FougereError<Refused<Address, Op>>);
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
    items: itemsOf<Rows<Answered>>(data),
    total: pageOf(data).total,
    hasMore: pageOf(data).hasMore,
    loading,
    error,
    refresh,
  };
}

export function useCommand<
  Handler,
  Address extends string,
  Op extends keyof Handler & string,
>(facade: FacadeName<Handler, Address>, op: Op) {
  type Answered = Answer<Handler, Op>;
  const entityKey = addressOf(facade);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<FougereError<Refused<Address, Op>> | null>(null);

  const execute = useCallback(
    async (input?: CallInput): Promise<Answered> => {
      setLoading(true);
      setError(null);
      try {
        const result = (await sendCall(fetcher, callOf(facade, op), invocationOf(input))) as Answered;
        // The link: same entity designated on both sides → revalidate its queries.
        revalidate(mountedKeys(entityKey));

        return result;
      } catch (err) {
        const failure = asFougereError(err, entityKey, op) as FougereError<Refused<Address, Op>>;
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
