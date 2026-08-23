import type { Call } from '../contract/Call.js';
import { ErrorCode, FougereError } from '../wire/errors.js';
import { DispatchEvent } from './DispatchEvent.js';
import { DispatchLifecycle } from './DispatchLifecycle.js';
import type { DispatchPort } from './DispatchPort.js';
import type { Route } from './Route.js';
import type { RoutePolicy } from './RoutePolicy.js';
import { RouteRegistry } from './RouteRegistry.js';

/** Resolves and executes every call through the same transverse lifecycle. */
export class Dispatcher implements DispatchPort {
  constructor(
    private readonly routes: RouteRegistry,
    private readonly lifecycle = new DispatchLifecycle(),
    private readonly policy?: RoutePolicy,
  ) {}

  async dispatch(call: Call): Promise<unknown> {
    let route: Route | undefined;
    this.lifecycle.publish(DispatchEvent.received(call));

    try {
      const known = this.routes.find(call.address);
      const resolved = known ?? await this.routes.resolve(call.address);
      route = resolved && (!this.policy || this.policy.accepts(resolved)) ? resolved : undefined;
      if (!route) {
        throw this.policy?.notFound?.(call, this.routes.routes()) ?? this.notFound(call);
      }

      this.lifecycle.publish(DispatchEvent.resolved(call, route.kind));
      const result = await route.execute(call);
      this.lifecycle.publish(DispatchEvent.completed(call, route.kind));
      return result;
    } catch (error) {
      this.lifecycle.publish(DispatchEvent.failed(call, error, route?.kind));
      throw error;
    } finally {
      this.lifecycle.publish(DispatchEvent.settled(call, route?.kind));
    }
  }

  private notFound(call: Call): FougereError {
    const served = this.routes.routes()
      .filter((route) => !this.policy || this.policy.accepts(route))
      .filter((route) => route.address.entity === call.address.entity)
      .filter((route) => route.kind === 'system'
        || route.address.surface === call.address.surface)
      .map((route) => route.address.operation);
    const operation = call.address.operation;
    const entity = call.address.entity;
    const message = entity === 'rpc'
      ? `Unknown rpc operation '${operation}'. `
        + (served.length ? `It serves ${served.join(', ')}.` : 'It serves nothing.')
      : served.length
        ? `Unknown operation '${operation}' on '${entity}'. It serves ${served.join(', ')}.`
        : `No route serves '${call.address}'`;

    return new FougereError({ code: ErrorCode.NOT_FOUND, message, entity, operation });
  }
}
