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
import { FougereError, ErrorCode } from './errors.js';
import { reconstruct, type SchemaView, type Fields, type SchemaDescriptor } from '@fougere/schema';

interface Route {
  frond: string;
  transport: Transport;
  /**
   * The entity's schema, rebuilt from the identity card — the same
   * `SchemaConstructor` shape `entity({...})` produces, live validation
   * included. Reconstructed once per entity, at discovery time.
   *
   * **Absent when the door stores nothing.** A handler may carry no entity, so the card
   * publishes it with ops and no shape; there is nothing to rebuild and pretending
   * otherwise would hand callers an empty schema that validates everything.
   */
  schema?: SchemaView;
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

  /** Which remote label claimed a door name — so a second claim can name the first. */
  const claimedBy = new Map<string, string>();

  const discover = async (): Promise<void> => {
    // Asking is concurrent; INDEXING is not, and is done in the order `remotes` declares.
    // Reading the cards inside the race made "which remote won" depend on who answered
    // first, so the same two remotes could resolve differently between two runs.
    const cards = await Promise.all(
      [...pending].map(async ([label, url]) => {
        const transport = transports.get(url) ?? makeTransport(url);
        transports.set(url, transport);
        try {
          const card = (await transport({ entity: RPC_ENTITY, op: 'discover' }, EMPTY_INVOCATION)) as IdentityCard;
          return { label, transport, card };
        } catch {
          // Unreachable — stays pending, retried on the next miss.
          return undefined;
        }
      }),
    );

    for (const answered of cards) {
      if (!answered) continue;
      const { label, transport, card } = answered;
      pending.delete(label);

      for (const frond of card.fronds) {
        // Doors only. A fact is not routable — nobody calls it, it arrives — so
        // adding one here would answer a call with a transport to a door that
        // does not exist.
        for (const door of frond.doors) {
          const held = claimedBy.get(door.name);
          /**
           * Two remotes claiming one name is refused, not silently arbitrated.
           *
           * `byEntity` is keyed by the door name alone, so the second claim used to be
           * dropped with `if (!byEntity.has(...))` — no warning, and the winner was
           * whichever remote answered first. The local boot already refuses the same
           * collision (`assertOneOwnerPerKey`) and it refused the OTHER duplicate: in
           * process the last frond loaded won, here the first discovered did. One
           * application, two topologies, two different handlers answering — which is
           * precisely the gradient not holding.
           *
           * Refusing is the honest answer while a call names an entity and not a frond.
           * `FrondCall` already carries an optional `frond`; the day it is required, this
           * becomes a disambiguation instead of a refusal.
           */
          if (held !== undefined && held !== label) {
            throw new FougereError({
              code: ErrorCode.INTERNAL_ERROR,
              message:
                `Two remotes serve '${door.name}': '${held}' and '${label}'.\n`
                + `  A call names an entity, not a frond, so nothing could choose between them.\n`
                + `  - Keep one of the two out of \`remotes:\`, or\n`
                + `  - expose one of them under a different entity name.`,
              entity: door.name,
            });
          }
          claimedBy.set(door.name, label);
          byEntity.set(door.name, {
            frond: frond.name,
            transport,
            ...(door.schema ? { schema: reconstruct(door.schema as SchemaDescriptor) } : {}),
          });
        }
      }
    }
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

/**
 * Does this name designate an operation at all? `then` is excluded so the façade is
 * never mistaken for a thenable, and `Object.prototype`'s own names so `constructor`
 * or `toString` cannot be called across the wire.
 */
function isOpName(prop: string | symbol): prop is string {
  return typeof prop === 'string' && prop !== 'then' && !Object.hasOwn(Object.prototype, prop);
}

/**
 * Façade-shaped stand-in — the consumer can't tell it from a local facade.
 *
 * Every trap answers the same question, and that is the point: the runner asks
 * `Object.hasOwn(facade, op)` before calling, so a proxy that only trapped `get`
 * reported *no* operations and every split call came back `Unknown operation` —
 * `get` said yes, `hasOwn` said no, and the runner believed `hasOwn`.
 *
 * The stand-in claims every legal op name because it cannot know better: routing is
 * lazy on purpose (the card is fetched at the first miss), and the remote is the
 * authority on its own surface anyway. An op it does not serve comes back as its
 * NOT_FOUND — judged where it is owned, which is the same answer a local façade gives.
 */
export function createRemoteFacade(entity: string, router: RemoteRouter): Facade {
  const opFn = (op: string) => async (invocation: InvocationContext = EMPTY_INVOCATION) => {
    const { frond, transport } = await router.route(entity);
    const call: FrondCall = { frond, entity, op };
    return transport(call, invocation);
  };

  return new Proxy({} as Facade, {
    get: (_target, prop) => (isOpName(prop) ? opFn(prop) : undefined),
    has: (_target, prop) => isOpName(prop),
    getOwnPropertyDescriptor: (_target, prop) =>
      // `configurable: true` is required: a proxy may not report a non-configurable
      // property that the target does not actually have.
      isOpName(prop)
        ? { value: opFn(prop), writable: false, enumerable: true, configurable: true }
        : undefined,
  });
}
