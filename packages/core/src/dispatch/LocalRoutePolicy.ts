import type { Call } from '../wire/Call.js';
import { ErrorCode } from '../wire/ErrorCode.js';
import { FougereError } from '../wire/FougereError.js';
import { RPC_ADDRESS } from '../wire/RpcAnswer.js';
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
    if (call.address.address === RPC_ADDRESS) return undefined;

    const served = servedOperations(call, routes, this);
    if (served.length > 0) return routeNotFound(call, served);

    const hosted = this.hostedNames(call.address.surface);
    const { address, surface } = call.address;

    return new FougereError({
      code: ErrorCode.NOT_FOUND,
      message: (surface
        ? `'${address}' is not served on surface '${surface}'`
        : `Nothing here answers at '${address}'`)
        + (hosted.length ? `. Served here: ${hosted.join(', ')}.` : '. This app serves no address.'),
      address,
      operation: call.address.operation,
    });
  }
}
