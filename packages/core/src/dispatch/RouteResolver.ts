import type { RouteAddress } from '../contract/RouteAddress.js';
import type { Route } from './Route.js';

/** Resolves routes that cannot be known when the registry is built. */
export interface RouteResolver {
  resolve(address: RouteAddress): Route | undefined | Promise<Route | undefined>;
}
