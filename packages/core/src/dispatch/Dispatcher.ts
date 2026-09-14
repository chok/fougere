import type { Call } from '../wire/Call.js';
import { DispatchEvent } from './DispatchEvent.js';
import { DispatchLifecycle } from './DispatchLifecycle.js';
import type { DispatchPort } from './DispatchPort.js';
import type { Route } from './Route.js';
import type { RoutePolicy } from './RoutePolicy.js';
import { RouteRegistry } from './RouteRegistry.js';
import { routeNotFound, servedOperations } from './routeNotFound.js';
import type { InFlight } from './InFlight.js';
import type { Journal } from './Journal.js';

/** Resolves and executes every call through the same transverse lifecycle. */
export class Dispatcher implements DispatchPort {
  constructor(
    private readonly routes: RouteRegistry,
    private readonly inFlight: InFlight,
    private readonly lifecycle = new DispatchLifecycle(),
    private readonly policy?: RoutePolicy,
    private readonly journalOf?: () => Journal | undefined,
  ) {}

  /**
   * A kept call publishes no dispatch event and enters no flight: it has not been answered,
   * and counting it here would report one call spanning the days until its hour.
   */
  private async keep(call: Call, runAt: number): Promise<undefined> {
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
    this.lifecycle.publish(DispatchEvent.received(call));

    try {
      release = this.inFlight.enter(call.address.entity, call.address.operation);
      const known = this.routes.find(call.address);
      const resolved = known ?? await this.routes.resolve(call.address);
      route = resolved && (!this.policy || this.policy.accepts(resolved)) ? resolved : undefined;
      if (!route) {
        throw this.policy?.notFound?.(call, this.routes.routes())
          ?? routeNotFound(call, servedOperations(call, this.routes.routes(), this.policy));
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
