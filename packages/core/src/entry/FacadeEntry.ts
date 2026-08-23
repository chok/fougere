import { Call } from '../contract/Call.js';
import type { InvocationInput } from '../contract/Invocation.js';
import { RouteAddress } from '../contract/RouteAddress.js';
import type { DispatchPort } from '../dispatch/DispatchPort.js';

/** Object-shaped entry that turns facade method calls into canonical dispatches. */
export class FacadeEntry {
  readonly operations: Record<string, Function>;

  constructor(
    private readonly dispatcher: DispatchPort,
    private readonly entity: string,
    operationNames?: Iterable<string>,
    private readonly surface?: string,
  ) {
    this.operations = operationNames
      ? Object.fromEntries([...operationNames].map((name) => [name, this.operation(name)]))
      : new Proxy({}, {
        get: (_target, name) => typeof name === 'string' && name !== 'then'
          ? this.operation(name)
          : undefined,
      });
  }

  private operation(name: string): (invocation?: InvocationInput) => Promise<unknown> {
    return (invocation) => this.dispatcher.dispatch(new Call(
      new RouteAddress({
        entity: this.entity,
        operation: name,
        ...(this.surface !== undefined ? { surface: this.surface } : {}),
      }),
      invocation,
    ));
  }
}
