import type { Call } from '../wire/Call.js';
import { DispatchEvent } from './DispatchEvent.js';
import { DispatchLifecycle } from './DispatchLifecycle.js';
import type { DispatchPort } from './DispatchPort.js';
import type { Route } from './Route.js';
import type { RoutePolicy } from './RoutePolicy.js';
import { RouteRegistry } from './RouteRegistry.js';
import { routeNotFound, servedOperations } from './routeNotFound.js';
import type { InFlight } from './InFlight.js';
import type { Journal } from '../wire/Journal.js';

/**
 * Runs every call through the same lifecycle, and the port a link stands in front of.
 * Ex: `Dispatcher` for its frond, `Dispatcher<PostHandler>` for that handler.
 */
export class Dispatcher<H = never> implements DispatchPort {
  declare private readonly standsAt?: H;

  constructor(
    private readonly routes: RouteRegistry,
    private readonly inFlight: InFlight,
    private readonly lifecycle = new DispatchLifecycle(),
    private readonly policy?: RoutePolicy,
    private readonly journalOf?: () => Journal | undefined,
  ) {}

  private async routeFor(call: Call): Promise<Route> {
    const known = this.routes.find(call.address);
    const resolved = known ?? await this.routes.resolve(call.address);
    const route = resolved && (!this.policy || this.policy.accepts(resolved)) ? resolved : undefined;
    if (!route) {
      throw this.policy?.notFound?.(call, this.routes.routes())
        ?? routeNotFound(call, servedOperations(call, this.routes.routes(), this.policy));
    }

    return route;
  }

  private async keep(call: Call, runAt: number): Promise<undefined> {
    await this.routeFor(call);

    const journal = this.journalOf?.();
    if (!journal) {
      throw new Error(
        `${call.address.toString()} asks to run at ${new Date(runAt).toISOString()}, and nothing keeps it.`
        + ' Install a package answering Journal — @fougere/workflow.',
      );
    }

    await journal.keep(call, runAt);

    return undefined;
  }

  async dispatch(call: Call): Promise<unknown> {
    const { runAt } = call.invocation;
    if (runAt !== undefined) return this.keep(call, runAt);

    let route: Route | undefined;
    let release: (() => void) | undefined;
    const watched = this.lifecycle.observed();
    const request = watched ? this.lifecycle.request() : undefined;
    if (watched) this.lifecycle.publish(DispatchEvent.received(call, request));

    try {
      release = this.inFlight.enter(call.address.address, call.address.operation);
      route = await this.routeFor(call);

      if (watched) this.lifecycle.publish(DispatchEvent.resolved(call, route.kind, request));
      const result = await route.execute(call);
      if (watched) this.lifecycle.publish(DispatchEvent.completed(call, route.kind, request));

      return result;
    } catch (error) {
      if (watched) this.lifecycle.publish(DispatchEvent.failed(call, error, route?.kind, request));
      throw error;
    } finally {
      if (watched) this.lifecycle.publish(DispatchEvent.settled(call, route?.kind, request));
      release?.();
    }
  }

}
