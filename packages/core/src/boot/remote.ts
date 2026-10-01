/**
 * Remote façade — what resolve() falls back to.
 *
 * Documented: [the gradient](https://fougere.dev/docs/infra/gradient).
 */
import type { FrondCall } from '../wire/FrondCall.js';
import type { StateShape } from '../wire/StateShape.js';
import type { Transport } from '../wire/Transport.js';
import { RPC_ADDRESS } from '../wire/RpcAnswer.js';
import { assertIdentityCard } from '../wire/card/IdentityCard.js';
import { runMiddlewares, type AppMiddleware } from '../wire/AppMiddleware.js';
import { type OperationContext } from '../wire/OperationContext.js';
import { Invocation } from '../wire/Invocation.js';
import { type InvocationContext } from '../wire/InvocationContext.js';
import { ErrorCode } from '../wire/ErrorCode.js';
import { FougereError } from '../wire/FougereError.js';
import { Card, type SchemaView } from '@fougere/schema';
import { dynamicOperations } from '../entry/facade.js';
import { decoded } from '../dispatch/decoded.js';

interface Route {
  frond: string;
  transport: Transport;
  /**
   * What each operation answers, rebuilt from the identity card — the same `SchemaConstructor`
   * shape `entity({...})` produces, live validation included.
   */
  outputs: Map<string, SchemaView>;
}

/** An op another process serves that is handed a fact when it is announced. */
export interface RemoteListener {
  address: string;
  op: string;
}

export interface RemoteRouter {
  route(address: string): Promise<Route>;
  /** The schema a remote STORES under an entity's name — `undefined` when none does. */
  schemaOf(entity: string): Promise<SchemaView | undefined>;
  /**
   * Who listens to a fact elsewhere, read off the cards — and which remotes could not be asked,
   * since a remote that did not answer may listen too.
   */
  listenersOf(fact: string): Promise<{ listeners: RemoteListener[]; unreachable: string[] }>;
}

export function createRemoteRouter(
  remotes: Record<string, string>,
  makeTransport: (url: string) => Transport,
): RemoteRouter {
  const byAddress = new Map<string, Route>();
  const stored = new Map<string, SchemaView>();
  const byFact = new Map<string, RemoteListener[]>();
  // The remotes config key is a label for the address — the identity card is
  // what decides which addresses answer behind it.
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
          const answer = await transport({ address: RPC_ADDRESS, op: 'discover' }, Invocation.empty);

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
      claimFacades(answered, byAddress, claimedBy);
      storedBy(answered, stored);
      listenedBy(answered, byFact);
    }
  };

  return {
    async schemaOf(entity) {
      if (!stored.has(entity) && pending.size > 0) await discover();

      return stored.get(entity);
    },
    async listenersOf(fact) {
      if (pending.size > 0) await discover();

      return { listeners: byFact.get(fact) ?? [], unreachable: [...pending.keys()] };
    },
    async route(address) {
      if (!byAddress.has(address) && pending.size > 0) await discover();
      const hit = byAddress.get(address);
      if (hit) return hit;
      if (pending.size > 0) {
        throw new FougereError({
          code: ErrorCode.SERVICE_UNAVAILABLE,
          message: `No reachable remote serves '${address}' — unreachable: ${[...pending.keys()].join(', ')}.\n`
          + '  Placed in `fronds:` with an address, and did not answer.',
          address,
        });
      }
      throw new FougereError({
        code: ErrorCode.NOT_FOUND,
        message: `No declared remote serves '${address}'.\n`
          + '  Nothing here serves it either — add its frond to `fronds:`/`scan:`, or give the frond that does an address in `fronds:`.',
        address,
      });
    },
  };
}

type Facade = Record<string, (invocation?: InvocationContext) => Promise<unknown>>;

/** Façade-shaped stand-in — the consumer can't tell it from a local facade. */
export function createRemoteFacade(
  address: string,
  router: RemoteRouter,
  middlewaresFor: (address: string) => AppMiddleware[],
  shape: StateShape,
): Facade {
  const opFn = (op: string) => async (received: InvocationContext = Invocation.empty) => {
    const { frond, transport, outputs } = await router.route(address);
    const call: FrondCall = { frond, address, op };
    const state = received.crossed ? { ...received.state } : shape.judge(received.state, address, op);
    const invocation = { ...received, state };
    const entered = { ...state };
    const ctx: OperationContext = {
      address, frond, operation: op, args: [], state, invocation, crosses: true,
    };
    const addressed = (error: unknown): never => { throw error instanceof FougereError ? error.at(address, op) : error; };
    const answer = await runMiddlewares(middlewaresFor(address), ctx, () =>
      transport(call, { ...(ctx.invocation ?? invocation), state: shape.judge(ctx.state, address, op, entered) }).catch(addressed))
      .catch(addressed);

    // What the op says it answers, put to work: a row crosses as data and comes back through
    // the same codecs a local facade applies, so a placement does not decide what a caller holds.
    return decoded(outputs.get(op), answer);
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
  byAddress: Map<string, Route>,
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
            + `  A call names an address, not a frond, so nothing could choose between them.\n`
            + `  - Keep one of the two out of \`remotes:\`, or\n`
            + `  - expose one of them under a different address.`,
          address: facade.name,
        });
      }

      claimedBy.set(facade.name, label);
      byAddress.set(facade.name, {
        frond: frond.name,
        transport,
        outputs: new Map(facade.ops.flatMap((op) =>
          op.output ? [[op.name, Card.fromDescriptor(op.output).toSchema()] as const] : [])),
      });
    }
  }
}

/** What each remote stores, by entity name — what `schemaFor` answers for a row kept elsewhere. */
function storedBy({ label, url, answer }: Answered, stored: Map<string, SchemaView>): void {
  for (const frond of assertIdentityCard(answer, `Remote '${label}' (${url})`).fronds) {
    for (const entity of frond.entities) stored.set(entity.name, Card.fromDescriptor(entity.schema).toSchema());
  }
}

/** Who listens to what on each remote — the `listens` an op states on the card it serves. */
function listenedBy({ label, url, answer }: Answered, byFact: Map<string, RemoteListener[]>): void {
  for (const frond of assertIdentityCard(answer, `Remote '${label}' (${url})`).fronds) {
    for (const facade of frond.facades) {
      for (const op of facade.ops) {
        if (!op.listens) continue;
        byFact.set(op.listens, [...(byFact.get(op.listens) ?? []), { address: facade.name, op: op.name }]);
      }
    }
  }
}
