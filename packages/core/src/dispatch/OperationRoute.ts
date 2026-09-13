import type { Call } from '../wire/Call.js';
import type { RouteAddress } from '../wire/RouteAddress.js';
import type { Route } from './Route.js';
import type { RouteExecution } from './RouteExecution.js';

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
