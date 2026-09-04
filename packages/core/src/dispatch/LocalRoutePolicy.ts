import type { Call } from '../wire/call.js';
import { ErrorCode, FougereError } from '../wire/errors.js';
import type { Route } from './Route.js';
import type { RoutePolicy } from './RoutePolicy.js';
import { routeNotFound, servedOperations } from './routeNotFound.js';

/** Incoming calls may execute here but never forward to another host. */
export class LocalRoutePolicy implements RoutePolicy {
  constructor(private readonly hostedNames: (surface?: string) => string[]) {}

  accepts(route: Route): boolean {
    return route.kind !== 'remote';
  }

  notFound(call: Call, routes: readonly Route[]): Error | undefined {
    if (call.address.entity === 'rpc') return undefined;

    const served = servedOperations(call, routes, this);
    if (served.length > 0) return routeNotFound(call, served);

    const hosted = this.hostedNames(call.address.surface);
    const entity = call.address.entity;
    const surface = call.address.surface;
    return new FougereError({
      code: ErrorCode.NOT_FOUND,
      message: (surface
        ? `Entity '${entity}' is not served on surface '${surface}'`
        : `Entity '${entity}' is not hosted here`)
        + (hosted.length ? `. Hosted here: ${hosted.join(', ')}.` : '. This app hosts no entity.'),
      entity,
      operation: call.address.operation,
    });
  }
}
