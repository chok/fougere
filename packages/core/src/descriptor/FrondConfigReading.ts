import type { FrondConfig } from '../FrondConfig.js';
import type { EntityEntry } from './EntityEntry.js';
import type { FrondDescriptor } from './FrondDescriptor.js';
import type { HandlerEntry } from './HandlerEntry.js';
import type { MiddlewareEntry } from './MiddlewareEntry.js';

/**
 * What a frond's `frond.config.ts` says about its descriptor — read the same way whether the scan
 * found the file or a statement imported it.
 */
export class FrondConfigReading {
  constructor(private readonly config: FrondConfig | undefined) {}

  /**
   * The only thing that needs flattening is the handler CLASS, which becomes its name — that is the
   * DI key. Everything else travels verbatim, so a slot added to `OperationOverride` reaches its
   * reader without a stop here; enumerating keys by hand is what used to drop whatever was added
   * last, the same invariant `cloneField` holds one layer down.
   */
  operationsOverrides(): FrondDescriptor['operationsOverrides'] {
    const operations = this.config?.operations;
    if (!operations) return undefined;

    return Object.fromEntries(
      Object.entries(operations).map(([key, { handler, ...rest }]) => [key, { ...rest, handlerName: handler?.name }]),
    );
  }

  /** `expose:` names what is exposed, and leaves the rest out; absent, a class says it of itself. */
  markExposed(entities: EntityEntry[], handlers: HandlerEntry[]): void {
    const exposed = this.config?.expose;
    if (exposed) {
      const named = new Set<string>(exposed);
      for (const entity of entities) entity.exposed = named.has((entity.entityClass as { name: string }).name);
      for (const handler of handlers) handler.exposed = named.has(handler.ctor.name);

      return;
    }

    for (const entity of entities) entity.exposed = (entity.entityClass as { __exposed?: boolean }).__exposed !== false;
    for (const handler of handlers) handler.exposed = (handler.ctor as { __exposed?: boolean }).__exposed !== false;
  }

  /** The middlewares outside in, as `middlewares:` lists them — what it does not list keeps its place, last. */
  inOrder(middlewares: MiddlewareEntry[]): MiddlewareEntry[] {
    const order = this.config?.middlewares;
    if (!order) return middlewares;
    const rank = (one: MiddlewareEntry) => (order.includes(one.name) ? order.indexOf(one.name) : order.length);

    return [...middlewares].sort((one, other) => rank(one) - rank(other));
  }

  /** What the file says of the frond as a whole, spread onto its descriptor. */
  members(): Pick<FrondDescriptor, 'pipes' | 'surfaces' | 'reads' | 'protocols' | 'operationsOverrides'> {
    const config = this.config;
    const operationsOverrides = this.operationsOverrides();

    return {
      ...(config?.pipes ? { pipes: config.pipes } : {}),
      ...(config?.surfaces ? { surfaces: config.surfaces } : {}),
      ...(config?.reads ? { reads: config.reads } : {}),
      ...(config?.protocols ? { protocols: config.protocols } : {}),
      ...(operationsOverrides ? { operationsOverrides } : {}),
    };
  }
}
