import type { Call } from '../contract/Call.js';
import { ErrorCode, FougereError } from '../wire/errors.js';
import type { Route } from './Route.js';
import type { RoutePolicy } from './RoutePolicy.js';

/** Describes an unresolved route from the destinations visible to one dispatcher. */
export class RouteNotFoundError extends FougereError {
  constructor(call: Call, routes: readonly Route[], policy?: RoutePolicy) {
    const served = routes
      .filter((route) => !policy || policy.accepts(route))
      .filter((route) => route.address.entity === call.address.entity)
      .filter((route) => route.kind === 'system'
        || route.address.surface === call.address.surface)
      .map((route) => route.address.operation);
    const operation = call.address.operation;
    const entity = call.address.entity;
    const message = entity === 'rpc'
      ? `Unknown rpc operation '${operation}'. `
        + (served.length ? `It serves ${served.join(', ')}.` : 'It serves nothing.')
      : served.length
        ? `Unknown operation '${operation}' on '${entity}'. It serves ${served.join(', ')}.`
        : `No route serves '${call.address}'`;

    super({ code: ErrorCode.NOT_FOUND, message, entity, operation });
  }
}
