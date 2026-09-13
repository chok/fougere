import { writable, get, type Readable } from 'svelte/store';
import type { ErrorCode, FougereError } from '@fougere/core/contract';
import { asFougereError, callOf, addressOf, fetcher, invocationOf, mountedKeys, revalidate, sendCall, type CallInput, type Answer, type Refused, type FacadeName } from '@fougere/app/client';

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
