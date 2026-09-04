import type { Call } from '../wire/call.js';
import { ErrorCode, FougereError } from '../wire/errors.js';
import type { Route } from './Route.js';
import type { RoutePolicy } from './RoutePolicy.js';

/** The operations this dispatcher would have served for the entity the call names. */
export function servedOperations(
  call: Call,
  routes: readonly Route[],
  policy?: RoutePolicy,
): readonly string[] {
  return routes
    .filter((route) => !policy || policy.accepts(route))
    .filter((route) => route.address.entity === call.address.entity)
    .filter((route) => route.kind === 'system' || route.address.surface === call.address.surface)
    .map((route) => route.address.operation);
}

/** `Unknown operation 'draft' on 'post'. It serves list, findById.` */
export function routeNotFound(
  call: Call,
  served: readonly string[],
): FougereError {
  const { entity, operation } = call.address;
  const message = entity === 'rpc'
    ? `Unknown rpc operation '${operation}'. `
      + (served.length ? `It serves ${served.join(', ')}.` : 'It serves nothing.')
    : served.length
      ? `Unknown operation '${operation}' on '${entity}'. It serves ${served.join(', ')}.`
      : `No route serves '${call.address}'`;

  return new FougereError({ code: ErrorCode.NOT_FOUND, message, entity, operation });
}
