/**
 * Remote façade — what resolve() falls back to.
 *
 * Documented: [the gradient](https://fougere.dev/docs/infra/gradient).
 */
import type { FrondCall } from '../wire/FrondCall.js';
import type { StateShape } from '../wire/StateShape.js';
import type { Transport } from '../wire/Transport.js';
import { RPC_ENTITY } from '../wire/RpcAnswer.js';
import { assertIdentityCard } from '../wire/card/IdentityCard.js';
import { runMiddlewares, type AppMiddleware } from '../wire/AppMiddleware.js';
import { type OperationContext } from '../wire/OperationContext.js';
import { Invocation } from '../wire/Invocation.js';
import { type InvocationContext } from '../wire/InvocationContext.js';
import { ErrorCode } from '../wire/ErrorCode.js';
import { FougereError } from '../wire/FougereError.js';
import { Card, type SchemaView, type SchemaDescriptor } from '@fougere/schema';
import { dynamicOperations } from '../entry/facade.js';
import { decoded } from '../dispatch/decoded.js';

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

  /** Which remote label claimed a facade name — so a second claim can name the first. */
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
          const answer = await transport({ entity: RPC_ENTITY, op: 'discover' }, Invocation.empty);

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

      pending.delete(answered.label);
      claimFacades(answered, byEntity, claimedBy);
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
          message: `No reachable remote hosts '${entity}' — unreachable: ${[...pending.keys()].join(', ')}.\n`
          + '  Named in `remotes:`, and did not answer.',
          entity,
        });
      }
      throw new FougereError({
        code: ErrorCode.NOT_FOUND,
        message: `No declared remote hosts '${entity}'.\n`
          + '  Nothing here serves it either — add its frond to `fronds:`/`scan:`, or name the frond that does in `remotes:`.',
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
  shape: StateShape,
): Facade {
  const opFn = (op: string) => async (received: InvocationContext = Invocation.empty) => {
    const { frond, transport, schema } = await router.route(entity);
    const call: FrondCall = { frond, entity, op };
    const state = received.crossed ? { ...received.state } : shape.judge(received.state, entity, op);
    const invocation = { ...received, state };
    const entered = { ...state };
    const ctx: OperationContext = {
      entity, frond, operation: op, args: [], state, invocation,
    };
    const answer = await runMiddlewares(middlewaresFor(entity), ctx, () =>
      transport(call, { ...(ctx.invocation ?? invocation), state: shape.judge(ctx.state, entity, op, entered) }));

    // The schema the card carried, put to work: a row crosses as data and comes back through
    // the same codecs a local facade applies, so a placement does not decide what a caller
    // holds. It is the ENTITY's — an op serving a narrower view is the far side's business,
    // and what this card names is the shape it publishes.
    return decoded(schema, answer);
  };

  return dynamicOperations(opFn) as Facade;
}

/** What one remote answered `discover` with, once it has been reached. */
interface Answered {
  label: string;
  url: string;
  transport: Transport;
  answer: unknown;
}

/**
 * Which remote serves which facade. Facades only: a fact is not routable — nobody calls it, it
 * arrives — so adding one here would answer a call with a transport to a facade that does not
 * exist. Two remotes claiming one name is refused, never silently arbitrated.
 */
function claimFacades(
  { label, url, transport, answer }: Answered,
  byEntity: Map<string, Route>,
  claimedBy: Map<string, string>,
): void {
  const card = assertIdentityCard(answer, `Remote '${label}' (${url})`);

  for (const frond of card.fronds) {
    for (const facade of frond.facades) {
      const first = claimedBy.get(facade.name);
      if (first !== undefined && first !== label) {
        throw new FougereError({
          code: ErrorCode.INTERNAL_ERROR,
          message:
            `[claim] Two remotes serve '${facade.name}': '${first}' and '${label}'.\n`
            + `  A call names an entity, not a frond, so nothing could choose between them.\n`
            + `  - Keep one of the two out of \`remotes:\`, or\n`
            + `  - expose one of them under a different entity name.`,
          entity: facade.name,
        });
      }

      claimedBy.set(facade.name, label);
      byEntity.set(facade.name, {
        frond: frond.name,
        transport,
        ...(facade.schema ? { schema: Card.fromDescriptor(facade.schema as SchemaDescriptor).toSchema() } : {}),
      });
    }
  }
}
