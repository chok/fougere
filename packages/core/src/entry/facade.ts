import { Call } from '../contract/Call.js';
import type { InvocationInput } from '../contract/Invocation.js';
import { RouteAddress } from '../contract/RouteAddress.js';
import type { DispatchPort } from '../dispatch/DispatchPort.js';

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

/** Turns facade method calls into canonical dispatches. */
export function facadeOperations(
  dispatcher: DispatchPort,
  entity: string,
  operationNames?: Iterable<string>,
  surface?: string,
): Record<string, Operation> {
  const operation = (name: string): Operation => (invocation) => dispatcher.dispatch(new Call(
    new RouteAddress({
      entity,
      operation: name,
      ...(surface !== undefined ? { surface } : {}),
    }),
    invocation,
  ));

  return operationNames
    ? Object.fromEntries([...operationNames].map((name) => [name, operation(name)]))
    : dynamicOperations(operation);
}
