import type { Call } from '../contract/Call.js';
import { ErrorCode, FougereError } from '../wire/errors.js';
import { DispatchLifecycle } from './DispatchLifecycle.js';
import type { DispatchPort } from './DispatchPort.js';
import type { Route } from './Route.js';
import { RouteRegistry } from './RouteRegistry.js';

/** Resolves and executes every call through the same transverse lifecycle. */
export class Dispatcher implements DispatchPort {
  constructor(
    private readonly routes: RouteRegistry,
    private readonly lifecycle = new DispatchLifecycle(),
  ) {}

  async dispatch(call: Call): Promise<unknown> {
    let route: Route | undefined;
    this.lifecycle.publish({ stage: 'received', call });

    try {
      route = this.routes.find(call.address);
      if (!route) {
        throw new FougereError({
          code: ErrorCode.NOT_FOUND,
          message: `No route serves '${call.address}'`,
          entity: call.address.entity,
          operation: call.address.operation,
        });
      }

      this.lifecycle.publish({ stage: 'resolved', call, routeKind: route.kind });
      const result = await route.execute(call);
      this.lifecycle.publish({ stage: 'completed', call, routeKind: route.kind });
      return result;
    } catch (error) {
      this.lifecycle.publish({
        stage: 'failed',
        call,
        ...(route ? { routeKind: route.kind } : {}),
        error,
      });
      throw error;
    } finally {
      this.lifecycle.publish({
        stage: 'settled',
        call,
        ...(route ? { routeKind: route.kind } : {}),
      });
    }
  }
}
