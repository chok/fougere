/**
 * Remote façade — what resolve() falls back to.
 *
 * When a handler isn't hosted locally and remotes are declared, resolve()
 * returns a façade-shaped stand-in: same call surface as a local facade,
 * every operation executed through a Transport. Routing is lazy — on the
 * first miss, each declared remote is asked what it hosts (rpc.discover)
 * and the answer is cached. A remote that can't be reached stays pending
 * and is retried on the next miss instead of being cached as absent.
 */
import type { FrondCall, IdentityCard, Transport } from './call.js';
import { RPC_ENTITY } from './call.js';
import { EMPTY_INVOCATION, type InvocationContext } from './invocation.js';
import { FougereError, ErrorCode } from './middleware.js';

interface Route {
  frond: string;
  transport: Transport;
}

export interface RemoteRouter {
  route(entity: string): Promise<Route>;
}

export function createRemoteRouter(
  remotes: Record<string, string>,
  makeTransport: (url: string) => Transport,
): RemoteRouter {
  const byEntity = new Map<string, Route>();
  // The remotes config key is a label for the address — the identity card is
  // what decides which entities live behind it.
  const pending = new Map(Object.entries(remotes));
  const transports = new Map<string, Transport>();

  const discover = async (): Promise<void> => {
    await Promise.all(
      [...pending].map(async ([label, url]) => {
        const transport = transports.get(url) ?? makeTransport(url);
        transports.set(url, transport);
        try {
          const card = (await transport({ entity: RPC_ENTITY, op: 'discover' }, EMPTY_INVOCATION)) as IdentityCard;
          pending.delete(label);
          for (const frond of card.fronds) {
            for (const entity of frond.entities) {
              if (!byEntity.has(entity.name)) byEntity.set(entity.name, { frond: frond.name, transport });
            }
          }
        } catch {
          // Unreachable — stays pending, retried on the next miss.
        }
      }),
    );
  };

  return {
    async route(entity) {
      if (!byEntity.has(entity) && pending.size > 0) await discover();
      const hit = byEntity.get(entity);
      if (hit) return hit;
      if (pending.size > 0) {
        throw new FougereError({
          code: ErrorCode.SERVICE_UNAVAILABLE,
          message: `No reachable remote hosts '${entity}' — unreachable: ${[...pending.keys()].join(', ')}`,
          entity,
        });
      }
      throw new FougereError({
        code: ErrorCode.NOT_FOUND,
        message: `No declared remote hosts '${entity}'`,
        entity,
      });
    },
  };
}

type Facade = Record<string, (invocation?: InvocationContext) => Promise<unknown>>;

/** Façade-shaped stand-in — the consumer can't tell it from a local facade. */
export function createRemoteFacade(entity: string, router: RemoteRouter): Facade {
  return new Proxy({} as Facade, {
    get(_target, prop) {
      // A façade is not a thenable — `then` must stay absent for await-safety.
      if (typeof prop !== 'string' || prop === 'then') return undefined;
      return async (invocation: InvocationContext = EMPTY_INVOCATION) => {
        const { frond, transport } = await router.route(entity);
        const call: FrondCall = { frond, entity, op: prop };
        return transport(call, invocation);
      };
    },
  });
}
