import { Call } from '../wire/Call.js';

import { RouteAddress } from '../wire/RouteAddress.js';
import type { DispatchPort } from '../dispatch/DispatchPort.js';
import type { Received } from '../dispatch/Received.js';
import type { PartialInvocation } from '../wire/PartialInvocation.js';

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

/** The facade code calls: each operation takes the handler's own arguments. */
export function facadeOperations(
  dispatcher: DispatchPort,
  address: string,
  operationNames?: Iterable<string>,
  surface?: string,
  received?: Received,
): Record<string, Operation> {
  const send = sending(dispatcher, address, surface, received);

  return operationsOf((name) => (...args: unknown[]) => send(name, { args: withoutTrailingAbsence(args) }), operationNames);
}

/** What a door sends: the invocation it received, as a `Call`. */
export function callOperations(
  dispatcher: DispatchPort,
  address: string,
  operationNames?: Iterable<string>,
  surface?: string,
  received?: Received,
): Record<string, Operation> {
  const send = sending(dispatcher, address, surface, received);

  return operationsOf((name) => (invocation?: PartialInvocation) => send(name, invocation), operationNames);
}

function sending(dispatcher: DispatchPort, address: string, surface?: string, received?: Received) {
  return async (name: string, invocation?: PartialInvocation): Promise<unknown> => {
    const answer = await dispatcher.dispatch(new Call(
      new RouteAddress({
        address,
        operation: name,
        ...(surface !== undefined ? { surface } : {}),
      }),
      invocation,
    ));

    return received ? received(name, answer) : answer;
  };
}

function operationsOf(operation: (name: string) => Operation, operationNames?: Iterable<string>): Record<string, Operation> {
  return operationNames
    ? Object.fromEntries([...operationNames].map((name) => [name, operation(name)]))
    : dynamicOperations(operation);
}

function withoutTrailingAbsence(args: unknown[]): unknown[] {
  let length = args.length;
  while (length > 0 && args[length - 1] === undefined) length--;

  return args.slice(0, length);
}
