import type { Container } from '@fougere/container';
import { Call } from '../wire/Call.js';
import { RouteAddress } from '../wire/RouteAddress.js';
import type { AppMiddleware } from '../wire/AppMiddleware.js';
import type { ProviderEntry } from '../descriptor/ProviderEntry.js';

/** What a link in front of `Dispatcher` stands in front of: the rest of ONE call, found by the call it was handed. */
const REST = new WeakMap<Call, () => Promise<unknown>>();

/**
 * What answers `Dispatcher` in a frond's scope before anything stands in front of it — the rest of the
 * call, which the frond's chain reaches last. A link hands on the call it was given: one it built
 * itself is a call nobody made.
 */
export const theRest = {
  dispatch(call: Call): Promise<unknown> {
    const rest = REST.get(call);
    if (!rest) {
      throw new Error(`A link in front of Dispatcher handed on ${call.address.toString()}, a call it was not given. `
        + 'Hand the inner the call you received.');
    }

    return rest();
  },
};

/** Whether a frond puts something in front of its calls — a class declaring `implements Partial<Dispatcher>`. */
export function standsAroundCalls(providers: readonly ProviderEntry[]): boolean {
  return providers.some((provider) => provider.implements?.includes('Dispatcher'));
}

/**
 * The frond's chain as a middleware of the dispatch: each call becomes the `Call` its links read, and
 * the rest of it is what the innermost reaches.
 *
 * Documented: [ports](https://fougere.dev/docs/business/ports).
 */
export function aroundCalls(scope: Container): AppMiddleware {
  return async (context, next) => {
    const call = new Call(new RouteAddress({ address: context.address, operation: context.operation }), context.invocation);
    REST.set(call, next);

    return await scope.resolve<typeof theRest>('Dispatcher').dispatch(call) as never;
  };
}
