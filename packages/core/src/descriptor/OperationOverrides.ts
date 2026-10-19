import { RouteAddress } from '../wire/RouteAddress.js';
import { Protocols } from '../Protocol.js';
import type { FougereOperationProtocols } from '../FougereOperationProtocols.js';
import type { Diagnostic } from '../diagnostic.js';
import type { FrondDescriptor } from './FrondDescriptor.js';
import type { DeclaredAnswer } from './DeclaredAnswer.js';

export type OperationOverrideEntry = NonNullable<FrondDescriptor['operationsOverrides']>[string];

/**
 * What a frond's `operations:` says, keyed the way an op is named everywhere else — `post.list`.
 * A bare `list` named every handler's `list` at once.
 */
export class OperationOverrides {
  private constructor(private readonly frond: FrondDescriptor) {}

  static of(frond: FrondDescriptor): OperationOverrides {
    return new OperationOverrides(frond);
  }

  /** What is said about the ops one address answers, by op name. */
  at(address: string): Map<string, OperationOverrideEntry> {
    return new Map(this.entries()
      .filter(([route]) => route?.address === address)
      .map(([route, entry]) => [route!.operation, entry]));
  }

  get(address: string, operation: string): OperationOverrideEntry | undefined {
    return this.frond.operationsOverrides?.[new RouteAddress({ address, operation }).toString()];
  }

  /**
   * What the op says to each protocol this process can serve — `rest`, `graphql` — and, beside what
   * `operations:` states, the answers a door middleware bound to its handler declares it may give.
   */
  protocols(address: string, operation: string): FougereOperationProtocols {
    const entry = { ...this.get(address, operation) } as Record<string, Record<string, unknown> | undefined>;
    for (const { door, answers } of this.declaredAt(address, operation)) {
      const said = entry[door]?.responses as DeclaredAnswer[] | undefined;
      entry[door] = { ...entry[door], responses: [...(said ?? []), ...answers] };
    }

    return Object.fromEntries(Object.entries(entry).filter(([key]) => Protocols.find(key))) as FougereOperationProtocols;
  }

  /** The answers this frond's door middlewares declare for one op of the handler they stand around. */
  private declaredAt(address: string, operation: string): { door: string; answers: DeclaredAnswer[] }[] {
    return this.frond.middlewares.flatMap((middleware) => {
      const { door, handler } = middleware.ctor as { door?: string; handler?: abstract new (...args: never[]) => unknown };
      const answers = middleware.answers?.[operation];
      if (!door || !handler || !answers) return [];
      const stands = this.frond.handlers.some((one) =>
        one.address === address && (one.ctor === handler || one.ctor.prototype instanceof handler));

      return stands ? [{ door, answers }] : [];
    });
  }

  /** A key that names no op of this frond: a bare name, or an address the frond does not serve. */
  refusals(): Diagnostic[] {
    const served = [...new Set(this.frond.handlers.map((handler) => handler.address))];

    return this.entries().flatMap(([route, , key]) => {
      if (route && served.includes(route.address)) return [];

      const message = route
        ? `operations: '${key}' names the address '${route.address}', which ${this.frond.name} does not serve. `
          + `It serves ${served.join(', ') || 'nothing'}.`
        : `operations: '${key}' names no address. An op is named '<address>.<op>' — `
          + `${served.length === 1 ? `'${served[0]}.${key}'` : served.map((address) => `'${address}.${key}'`).join(' or ')}.`;

      return [{
        severity: 'blocking' as const,
        code: 'operation-override-unaddressed',
        filePath: this.frond.source.path ? `${this.frond.source.path}/frond.config.ts` : this.frond.name,
        frond: this.frond.name,
        subject: key,
        message,
      }];
    });
  }

  private entries(): [RouteAddress | undefined, OperationOverrideEntry, string][] {
    return Object.entries(this.frond.operationsOverrides ?? {})
      .map(([key, entry]) => [RouteAddress.parse(key), entry, key]);
  }
}
