import { Call } from '../wire/Call.js';

import { RouteAddress } from '../wire/RouteAddress.js';
import type { DispatchPort } from '../dispatch/DispatchPort.js';
import type { Received } from '../dispatch/Received.js';

type Operation = (...args: any[]) => unknown;

/** Facade for a contract whose operation names are only known at discovery. */
export function dynamicOperations(operation: (name: string) => Operation): Record<string, Operation> {
  const isOperationName = (name: string | symbol): name is string =>
    typeof name === 'string'
    && name !== 'then'
    && name !== 'toJSON'
    && !Object.hasOwn(Object.prototype, name);

  return new Proxy({}, {
    get: (_target, name) => (isOperationName(name) ? operation(name) : undefined),
    has: (_target, name) => isOperationName(name),
    getOwnPropertyDescriptor: (_target, name) => (isOperationName(name)
      ? { value: operation(name), writable: false, enumerable: true, configurable: true }
      : undefined),
  });
}

/**
 * Turns facade method calls into canonical dispatches.
 *
 * `received` is what this side puts back before handing the answer over: a row leaves as data
 * and `date-time` means a `Date` on both sides. A facade built without one hands over what the
 * wire carried, which is what a caller holding no schema can do.
 */
export function facadeOperations(
  dispatcher: DispatchPort,
  entity: string,
  operationNames?: Iterable<string>,
  surface?: string,
  received?: Received,
): Record<string, Operation> {
  const operation = (name: string): Operation => async (invocation) => {
    const answer = await dispatcher.dispatch(new Call(
      new RouteAddress({
        entity,
        operation: name,
        ...(surface !== undefined ? { surface } : {}),
      }),
      invocation,
    ));

    return received ? received(name, answer) : answer;
  };

  return operationNames
    ? Object.fromEntries([...operationNames].map((name) => [name, operation(name)]))
    : dynamicOperations(operation);
}
