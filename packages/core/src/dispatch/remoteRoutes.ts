import { OperationRoute } from './OperationRoute.js';
import type { RouteResolver } from './RouteResolver.js';

type RemoteFacade = Record<string, Function>;
export type RemoteFacadeResolver = (entity: string) => RemoteFacade | undefined;

/** Builds a remote route on the first call, once the remote façade can be resolved. */
export function remoteRoutes(facades: RemoteFacadeResolver): RouteResolver {
  return (address) => {
    if (address.surface !== undefined) return undefined;

    const facade = facades(address.entity);
    const operation = facade?.[address.operation];

    if (typeof operation !== 'function') return undefined;

    return new OperationRoute('remote', address, (call) => operation(call.invocation));
  };
}
