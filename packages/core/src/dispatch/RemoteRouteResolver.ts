import type { RouteAddress } from '../contract/RouteAddress.js';
import { RemoteRoute } from './RemoteRoute.js';
import type { Route } from './Route.js';
import type { RouteResolver } from './RouteResolver.js';

type RemoteFacade = Record<string, Function>;
export type RemoteFacadeResolver = (entity: string) => RemoteFacade | undefined;

/** Builds a remote route on the first call, after the remote façade can be resolved. */
export class RemoteRouteResolver implements RouteResolver {
  constructor(private readonly facades: RemoteFacadeResolver) {}

  resolve(address: RouteAddress): Route | undefined {
    if (address.surface !== undefined) return undefined;

    const facade = this.facades(address.entity);
    const operation = facade?.[address.operation];
    if (typeof operation !== 'function') return undefined;
    return new RemoteRoute(address, (call) => operation(call.invocation));
  }
}
