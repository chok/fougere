import { RouteAddress } from '../wire/RouteAddress.js';
import type { Route } from './Route.js';
import type { RouteResolver } from './RouteResolver.js';

/** Exact registry of every operation the application can dispatch. */
export class RouteRegistry {
  private readonly byAddress = new Map<string, Route>();
  private readonly resolvers: RouteResolver[] = [];
  private readonly pending = new Map<string, Promise<Route | undefined>>();

  get size(): number {
    return this.byAddress.size;
  }

  register(route: Route): void {
    const key = route.address.key();
    const existing = this.byAddress.get(key);
    if (existing) {
      throw new Error(
        `Route collision at '${route.address}': ${existing.kind} and ${route.kind}`,
      );
    }
    this.byAddress.set(key, route);
  }

  addResolver(resolver: RouteResolver): void {
    this.resolvers.push(resolver);
  }

  find(address: RouteAddress): Route | undefined {
    const exact = this.byAddress.get(address.key());
    if (exact || address.surface === undefined) return exact;

    const shared = this.byAddress.get(new RouteAddress({
      entity: address.entity,
      operation: address.operation,
    }).key());
    return shared?.kind === 'system' ? shared : undefined;
  }

  async resolve(address: RouteAddress): Promise<Route | undefined> {
    const known = this.find(address);
    if (known) return known;

    const key = address.key();
    const running = this.pending.get(key);
    if (running) return running;

    const resolution = this.resolveUnknown(address).finally(() => this.pending.delete(key));
    this.pending.set(key, resolution);
    return resolution;
  }

  private async resolveUnknown(address: RouteAddress): Promise<Route | undefined> {
    for (const resolver of this.resolvers) {
      const route = await resolver(address);
      if (!route) continue;
      this.register(route);
      return route;
    }
    return undefined;
  }

  routes(): Route[] {
    return [...this.byAddress.values()];
  }

  operationNames(entity: string, surface?: string): string[] {
    return this.routes()
      .filter((route) => route.address.entity === entity && route.address.surface === surface)
      .map((route) => route.address.operation);
  }
}
