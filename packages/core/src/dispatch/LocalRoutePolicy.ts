import type { Call } from '../contract/Call.js';
import { ErrorCode, FougereError } from '../wire/errors.js';
import type { Route } from './Route.js';
import type { RoutePolicy } from './RoutePolicy.js';
import { RouteNotFoundError } from './RouteNotFoundError.js';

/** Incoming calls may execute here but never forward to another host. */
export class LocalRoutePolicy implements RoutePolicy {
  constructor(private readonly hostedNames: (surface?: string) => string[]) {}

  accepts(route: Route): boolean {
    return route.kind !== 'remote';
  }

  notFound(call: Call, routes: readonly Route[]): Error | undefined {
    if (call.address.entity === 'rpc') return undefined;

    const unknownRoute = new RouteNotFoundError(call, routes, this);
    if (unknownRoute.servedOperations.length > 0) return unknownRoute;

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
