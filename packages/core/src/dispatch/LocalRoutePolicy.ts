import type { Call } from '../contract/Call.js';
import { ErrorCode, FougereError } from '../wire/errors.js';
import type { Route } from './Route.js';
import type { RoutePolicy } from './RoutePolicy.js';

/** Incoming calls may execute here but never forward to another host. */
export class LocalRoutePolicy implements RoutePolicy {
  constructor(private readonly hostedNames: (surface?: string) => string[]) {}

  accepts(route: Route): boolean {
    return route.kind !== 'remote';
  }

  notFound(call: Call, routes: readonly Route[]): Error | undefined {
    if (call.address.entity === 'rpc') return undefined;

    const operations = routes
      .filter((route) => this.accepts(route))
      .filter((route) => route.address.entity === call.address.entity)
      .filter((route) => route.address.surface === call.address.surface)
      .map((route) => route.address.operation);
    if (operations.length > 0) {
      return new FougereError({
        code: ErrorCode.NOT_FOUND,
        message: `Unknown operation '${call.address.operation}' on '${call.address.entity}'. `
          + `It serves ${operations.join(', ')}.`,
        entity: call.address.entity,
        operation: call.address.operation,
      });
    }

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
