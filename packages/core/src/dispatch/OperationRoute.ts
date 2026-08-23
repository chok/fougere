import type { Call } from '../contract/Call.js';
import type { RouteAddress } from '../contract/RouteAddress.js';
import type { Route } from './Route.js';

export type RouteExecution = (call: Call) => unknown | Promise<unknown>;

/** One executable route, distinguished by its routing kind. */
export class OperationRoute implements Route {
  constructor(
    readonly kind: Route['kind'],
    readonly address: RouteAddress,
    private readonly execution: RouteExecution,
  ) {}

  async execute(call: Call): Promise<unknown> {
    return (await this.execution(call)) ?? null;
  }
}
