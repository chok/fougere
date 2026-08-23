import type { RouteAddress } from '../contract/RouteAddress.js';
import type { Route } from './Route.js';

/** Exact registry of every operation the application can dispatch. */
export class RouteRegistry {
  private readonly byAddress = new Map<string, Route>();

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

  find(address: RouteAddress): Route | undefined {
    return this.byAddress.get(address.key());
  }

  routes(): Route[] {
    return [...this.byAddress.values()];
  }
}
