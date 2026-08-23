import type { Call } from '../contract/Call.js';
import { DispatchEvent } from './DispatchEvent.js';
import { DispatchLifecycle } from './DispatchLifecycle.js';
import type { DispatchPort } from './DispatchPort.js';
import type { Route } from './Route.js';
import type { RoutePolicy } from './RoutePolicy.js';
import { RouteRegistry } from './RouteRegistry.js';
import { RouteNotFoundError } from './RouteNotFoundError.js';
import type { InFlight } from './InFlight.js';

/** Resolves and executes every call through the same transverse lifecycle. */
export class Dispatcher implements DispatchPort {
  constructor(
    private readonly routes: RouteRegistry,
    private readonly inFlight: InFlight,
    private readonly lifecycle = new DispatchLifecycle(),
    private readonly policy?: RoutePolicy,
  ) {}

  async dispatch(call: Call): Promise<unknown> {
    let route: Route | undefined;
    let release: (() => void) | undefined;
    this.lifecycle.publish(DispatchEvent.received(call));

    try {
      release = this.inFlight.enter(call.address.entity, call.address.operation);
      const known = this.routes.find(call.address);
      const resolved = known ?? await this.routes.resolve(call.address);
      route = resolved && (!this.policy || this.policy.accepts(resolved)) ? resolved : undefined;
      if (!route) {
        throw this.policy?.notFound?.(call, this.routes.routes())
          ?? new RouteNotFoundError(call, this.routes.routes(), this.policy);
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
      release?.();
    }
  }

}
