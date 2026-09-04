import type { Call } from '../wire/call.js';
import type { Route } from './Route.js';

/** Restricts which registered routes one dispatch capability may enter. */
export interface RoutePolicy {
  accepts(route: Route): boolean;
  notFound?(call: Call, routes: readonly Route[]): Error | undefined;
}
