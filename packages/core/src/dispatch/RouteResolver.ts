import type { RouteAddress } from '../wire/RouteAddress.js';
import type { Route } from './Route.js';

/** Resolves routes that cannot be known when the registry is built. */
export type RouteResolver = (address: RouteAddress) => Route | undefined | Promise<Route | undefined>;
