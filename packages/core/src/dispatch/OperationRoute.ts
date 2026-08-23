import type { Call } from '../contract/Call.js';
import type { RouteAddress } from '../contract/RouteAddress.js';
import type { Route } from './Route.js';

export type RouteExecution = (call: Call) => unknown | Promise<unknown>;

/** Shared execution mechanics for concrete route kinds. */
export abstract class OperationRoute implements Route {
  abstract readonly kind: Route['kind'];

  constructor(
    readonly address: RouteAddress,
    private readonly execution: RouteExecution,
  ) {}

  async execute(call: Call): Promise<unknown> {
    return (await this.execution(call)) ?? null;
  }
}
