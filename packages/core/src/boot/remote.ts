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
import type { RemoteListener } from '../module/fact/RemoteListener.js';

interface Route {
  frond: string;
  transport: Transport;
  /** What each operation answers, rebuilt from the identity card. */
  outputs: Map<string, SchemaView>;
  /** The ops an announcement calls there — what its card says each one `listens` to. */
  listening: Set<string>;
}

export interface RemoteRouter {
  route(address: string): Promise<Route>;
  /** The schema a remote STORES under an entity's name — `undefined` when none does. */
  schemaOf(entity: string): Promise<SchemaView | undefined>;
  /** Who listens to a fact elsewhere, and which remotes could not be asked. */
  listenersOf(fact: string): Promise<{ listeners: RemoteListener[]; unreachable: string[] }>;
}

export function createRemoteRouter(
  remotes: Record<string, string>,
  transportAt: (url: string) => Transport,
): RemoteRouter {
  const byAddress = new Map<string, Route>();
  const stored = new Map<string, SchemaView>();
  const byFact = new Map<string, RemoteListener[]>();
  const pending = new Map(Object.entries(remotes));

  const remoteOfFacade = new Map<string, string>();

  const discover = async (): Promise<void> => {
    const cards = await Promise.all(
      [...pending].map(async ([label, url]) => {
        const transport = transportAt(url);
        try {
          const answer = await transport({ address: RPC_ADDRESS, op: 'discover' }, Invocation.empty);

          return { label, url, transport, answer };
        } catch {
          return undefined;
        }
      }),
    );

    for (const reached of cards) {
      if (!reached) continue;

      pending.delete(reached.label);
      registerRemoteFacades(reached, byAddress, remoteOfFacade);
      storedBy(reached, stored);
      listenedBy(reached, byFact);
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
          message: `No remote answered for '${address}'. Not reachable: ${[...pending.keys()].join(', ')}.`,
          address,
        });
      }
      throw new FougereError({
        code: ErrorCode.NOT_FOUND,
        message: `Nothing serves '${address}', here or at any address in \`fronds:\`. `
          + 'Add its frond to this app, or give the frond that serves it an address in `fronds:`.',
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
    const state = received.fromAnotherProcess ? { ...received.state } : shape.judge(received.state, address, op);
    const invocation = { ...received, state };
    const entered = { ...state };
    const ctx: OperationContext = {
      address, frond, operation: op, args: [], state, invocation, toAnotherProcess: true,
    };
    const addressed = (error: unknown): never => { throw error instanceof FougereError ? error.at(address, op) : error; };
    const answer = await runMiddlewares(middlewaresFor(address), ctx, () =>
      transport(call, { ...(ctx.invocation ?? invocation), state: shape.judge(ctx.state, address, op, entered) }).catch(addressed))
      .catch(addressed);

    return decoded(outputs.get(op), answer);
  };

  return dynamicOperations(opFn) as Facade;
}

interface RemoteAnswer {
  label: string;
  url: string;
  transport: Transport;
  answer: unknown;
}

function registerRemoteFacades(
  { label, url, transport, answer }: RemoteAnswer,
  byAddress: Map<string, Route>,
  remoteOfFacade: Map<string, string>,
): void {
  const card = assertIdentityCard(answer, `Remote '${label}' (${url})`);

  for (const frond of card.fronds) {
    for (const facade of frond.facades) {
      const first = remoteOfFacade.get(facade.name);
      if (first !== undefined && first !== label) {
        throw new FougereError({
          code: ErrorCode.INTERNAL_ERROR,
          message:
            `[claim] Two remotes serve '${facade.name}': '${first}' and '${label}'. `
            + 'Give only one of them an address in `fronds:`, or rename the handler in one of them.',
          address: facade.name,
        });
      }

      remoteOfFacade.set(facade.name, label);
      byAddress.set(facade.name, {
        frond: frond.name,
        transport,
        outputs: new Map(facade.ops.flatMap((op) =>
          op.output ? [[op.name, Card.fromDescriptor(op.output).toSchema()] as const] : [])),
        listening: new Set(facade.ops.flatMap((op) => (op.listens ? [op.name] : []))),
      });
    }
  }
}

function storedBy({ label, url, answer }: RemoteAnswer, stored: Map<string, SchemaView>): void {
  for (const frond of assertIdentityCard(answer, `Remote '${label}' (${url})`).fronds) {
    for (const entity of frond.entities) stored.set(entity.name, Card.fromDescriptor(entity.schema).toSchema());
  }
}

function listenedBy({ label, url, answer }: RemoteAnswer, byFact: Map<string, RemoteListener[]>): void {
  for (const frond of assertIdentityCard(answer, `Remote '${label}' (${url})`).fronds) {
    for (const facade of frond.facades) {
      for (const op of facade.ops) {
        if (!op.listens) continue;
        byFact.set(op.listens, [...(byFact.get(op.listens) ?? []), { address: facade.name, op: op.name }]);
      }
    }
  }
}
