import type { Container } from '@fougere/container';
import { Call } from '../wire/Call.js';
import { RouteAddress } from '../wire/RouteAddress.js';
import type { AppMiddleware } from '../wire/AppMiddleware.js';
import { StepPort } from './StepPort.js';

/** The step around a call: `Dispatcher`, a link handed each call as the `Call` it is. */
export const DISPATCH = new StepPort('Dispatcher', 'dispatch', 'the rest of the call');

/** A chain in front of the dispatch as a middleware of it — the frond's, or one handler's. */
export function aroundCalls(scope: Container, key: string): AppMiddleware {
  return async (context, next) => {
    const call = new Call(new RouteAddress({ address: context.address, operation: context.operation }), context.invocation);

    return await DISPATCH.hand(scope, key, call, next) as never;
  };
}
