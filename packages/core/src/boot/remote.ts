/** Remote façade — what resolve() falls back to. */
import type { FrondCall, Transport } from '../wire/call.js';
import { assertIdentityCard, RPC_ENTITY } from '../wire/call.js';
import { runMiddlewares, type AppMiddleware, type OperationContext } from '../wire/middleware.js';
import { EMPTY_INVOCATION, type InvocationContext } from '../wire/Invocation.js';
import { FougereError, ErrorCode } from '../wire/errors.js';
import { Card, type SchemaView, type SchemaDescriptor } from '@fougere/schema';
import { dynamicOperations } from '../entry/facade.js';

interface Route {
  frond: string;
  transport: Transport;
  /**
   * The entity's schema, rebuilt from the identity card — the same `SchemaConstructor` shape
   * `entity({...})` produces, live validation included.
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
          const answer = await transport({ entity: RPC_ENTITY, op: 'discover' }, EMPTY_INVOCATION);
          // Judged below and not here: this catch means "unreachable, retry", and a
          // refusal thrown inside it would be swallowed into another silent retry.
          return { label, url, transport, answer };
        } catch {
          // Unreachable — stays pending, retried on the next miss.
          return undefined;
        }
      }),
    );

    for (const answered of cards) {
      if (!answered) continue;
      const { label, url, transport, answer } = answered;
      pending.delete(label);
      const card = assertIdentityCard(answer, `Remote '${label}' (${url})`);

      for (const frond of card.fronds) {
        // Doors only. A fact is not routable — nobody calls it, it arrives — so
        // adding one here would answer a call with a transport to a door that
        // does not exist.
        for (const door of frond.doors) {
          const first = claimedBy.get(door.name);
          /** Two remotes claiming one name is refused, not silently arbitrated. */
          if (first !== undefined && first !== label) {
            throw new FougereError({
              code: ErrorCode.INTERNAL_ERROR,
              message:
                `Two remotes serve '${door.name}': '${first}' and '${label}'.\n`
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
            ...(door.schema ? { schema: Card.fromDescriptor(door.schema as SchemaDescriptor).toSchema() } : {}),
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

/** Façade-shaped stand-in — the consumer can't tell it from a local facade. */
export function createRemoteFacade(
  entity: string,
  router: RemoteRouter,
  middlewaresFor: (address: string) => AppMiddleware[],
): Facade {
  const opFn = (op: string) => async (invocation: InvocationContext = EMPTY_INVOCATION) => {
    const { frond, transport } = await router.route(entity);
    const call: FrondCall = { frond, entity, op };
    const ctx: OperationContext = {
      entity, frond, operation: op, args: [], state: invocation.state, invocation,
    };
    return runMiddlewares(middlewaresFor(entity), ctx, () =>
      transport(call, ctx.invocation ?? invocation));
  };

  return dynamicOperations(opFn) as Facade;
}
