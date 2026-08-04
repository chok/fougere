/**
 * Call contract — a frond call is a value.
 *
 * (frond, entity, op, invocation) → result, or a thrown FougereError.
 * A transport is a function that executes this call elsewhere; the local
 * runner below is the reference realization. Transports move the value,
 * they never reshape it.
 */
import { describe as describeSchema } from '@fougere/schema';
import type { InvocationContext } from './invocation.js';
import { FougereError, ErrorCode } from './middleware.js';
import { resolveIsReadOp, type OperationsMap } from './operation.js';
import type { App } from './types.js';

/** Target of a call — which façade operation, wherever it lives. */
export interface FrondCall {
  /** Frond name, when the caller knows it. Routing hint only. */
  frond?: string;
  /** Entity registration key (e.g. 'product'). */
  entity: string;
  /** Façade operation name (e.g. 'findById', 'search'). */
  op: string;
}

/** A transport executes a call somewhere else. Failures surface as thrown FougereError. */
export type Transport = (call: FrondCall, invocation: InvocationContext) => Promise<unknown>;

/** Reserved namespace — calls the runner answers itself, never a façade. */
export const RPC_ENTITY = 'rpc';

/**
 * One operation, as a stranger meets it — its name, what it is for, what it takes
 * and whether it reads or writes. Everything here already existed on the contract;
 * it just never left the process.
 */
export interface CardOp {
  name: string;
  /** The author's own doc sentence, when the method carries one. */
  description?: string;
  /** JSON Schema of what it accepts, when the contract names a view. */
  input?: unknown;
  /** JSON Schema of what it emits, when the contract names one. */
  output?: unknown;
  /** `query` reads, `command` writes — the same call REST turns into GET vs POST. */
  kind: 'query' | 'command';
}

/** What an app hosts — the wire projection of its scanned fronds. */
export interface IdentityCard {
  fronds: Array<{
    name: string;
    entities: Array<{
      name: string;
      ops: CardOp[];
      schema: unknown;
    }>;
  }>;
}

type Facade = Record<string, (invocation?: InvocationContext) => Promise<unknown>>;

/**
 * The container key of a façade — THE one place that spells the format.
 *
 * A surface is a named audience, and it is a key: `handlers/public/PostHandler.ts`
 * registers `public:postHandler` next to the default `postHandler`. The default
 * surface is the empty key, so callers that know nothing about surfaces keep
 * designating exactly what they designated before.
 *
 * Nobody outside this package builds this string: adapters ask `app.facadeFor()`,
 * which is why an adapter can stay structurally typed and core-free.
 */
export function facadeKeyOf(entityName: string, surface?: string): string {
  return surface ? `${surface}:${entityName}Handler` : `${entityName}Handler`;
}

/**
 * Where the contracts behind a façade live — the dual of `facadeKeyOf`.
 *
 * The façade answers calls; it does not say what it answers. That sentence used
 * to be true only inside `buildFacade`, so anything asking the app what it hosts
 * got bare names. A door and its terms are registered together, under the same
 * audience.
 */
export function contractsKeyOf(entityName: string, surface?: string): string {
  return `${facadeKeyOf(entityName, surface)}:contracts`;
}

/**
 * Serialize what the app hosts, for one audience. Served on `rpc.discover`,
 * cached by callers.
 *
 * Hosting means answering: an entity with no façade declares no operation, so
 * it is not listed — publishing its shape would hand an anonymous caller the
 * structure of tables it can never reach (the auth tables, typically), and
 * `fougere sync` would rebuild a schema with nothing to call on it.
 *
 * `surface` makes that sentence audience-aware rather than app-wide: a door
 * answers with what IT serves. Nothing falls back to the full façade — under a
 * named surface, an entity with no façade of its own is simply not there.
 */
export function identityCardOf(app: App, surface?: string): IdentityCard {
  return {
    fronds: app.fronds.map((frond) => ({
      name: frond.name,
      entities: frond.entities.flatMap((entity) => {
        const ops = facadeOps(app, entity.name, surface);
        if (ops.length === 0) return [];
        return [{
          name: entity.name,
          ops,
          schema: describeSchema(entity.entityClass, entity.name),
        }];
      }),
    })),
  };
}

function facadeOps(app: App, entityName: string, surface?: string): CardOp[] {
  let facade: Facade;
  try {
    facade = app.container.resolve<Facade>(facadeKeyOf(entityName, surface));
  } catch {
    return [];
  }

  // The façade is the list of names; the contracts are the terms. Registered
  // together, so a door that serves fewer ops also describes fewer.
  let contracts: OperationsMap | undefined;
  try {
    contracts = app.container.resolve<OperationsMap>(contractsKeyOf(entityName, surface));
  } catch {
    contracts = undefined;
  }

  return Object.keys(facade).map((name) => {
    const contract = contracts?.get(name);

    return {
      name,
      ...(contract?.description && { description: contract.description }),
      ...(contract?.input && { input: describeSchema(contract.input, name) }),
      ...(contract?.output && { output: describeSchema(contract.output, name) }),
      kind: resolveIsReadOp(name) ? 'query' as const : 'command' as const,
    };
  });
}

/**
 * Build the local runner — the reference realization of Transport.
 *
 * Resolves strictly from the app's own container: a call that lands here is
 * judged here. A miss is a typed NOT_FOUND, never a forward to another remote.
 */
export function createLocalRunner(app: App, surface?: string): Transport {
  return runnerFor(app, (key) => app.container.resolve<Facade>(key), surface);
}

/**
 * Build the app runner — same judgment, but resolution follows the app's
 * topology: local façades and remote doublures alike. This is the runner
 * an app's own entry points (browser endpoint, bridges) stand on.
 *
 * `surface` is the audience this runner serves, and it belongs to the DOOR that
 * builds the runner, never to the call: a caller cannot name its own audience
 * any more than it can name its own identity (`state` is stamped server-side
 * for the same reason). Reaching the admin door IS the proof. So `FrondCall`
 * gains nothing and the wire format gains nothing — a remote frond's audience
 * is simply which URL `remotes:` points at.
 */
export function createAppRunner(app: App, surface?: string): Transport {
  return runnerFor(app, (key) => app.resolve<Facade>(key), surface);
}

function runnerFor(app: App, resolveFacade: (key: string) => Facade, surface?: string): Transport {
  return async (call, invocation) => {
    if (call.entity === RPC_ENTITY) {
      if (call.op === 'discover') return identityCardOf(app, surface);
      throw new FougereError({
        code: ErrorCode.NOT_FOUND,
        message: `Unknown rpc operation '${call.op}'`,
        entity: RPC_ENTITY,
        operation: call.op,
      });
    }

    let facade: Facade;
    try {
      facade = resolveFacade(facadeKeyOf(call.entity, surface));
    } catch {
      // What IS hosted, so a wrong entity name (or a missing frond) reads at a glance.
      const hosted = app.fronds.flatMap((frond) => frond.entities.map((e) => e.name)).sort();
      throw new FougereError({
        code: ErrorCode.NOT_FOUND,
        message: (surface
          ? `Entity '${call.entity}' is not served on surface '${surface}'`
          : `Entity '${call.entity}' is not hosted here`)
          + (hosted.length ? `. Hosted here: ${hosted.join(', ')}.` : '. This app hosts no entity.'),
        entity: call.entity,
        operation: call.op,
      });
    }

    // Own properties only: a façade is a plain object, so a bare lookup reaches
    // Object.prototype — `constructor` echoed the invocation back, `toString`
    // answered. An op is what the façade declares, not what JS inherits.
    const fn = Object.hasOwn(facade, call.op) ? facade[call.op] : undefined;
    if (typeof fn !== 'function') {
      // Name what IS served: the façade is right here, and `op` is a bare string all
      // the way from `useQuery` — so a typo is the ordinary case, not the exotic one.
      const served = Object.keys(facade).filter((key) => typeof facade[key] === 'function');
      throw new FougereError({
        code: ErrorCode.NOT_FOUND,
        message: `Unknown operation '${call.op}' on '${call.entity}'. `
          + (served.length ? `It serves ${served.join(', ')}.` : 'It serves nothing.'),
        entity: call.entity,
        operation: call.op,
      });
    }
    // A call's result is JSON-shaped: undefined has no wire form, it
    // normalizes to null at the contract edge — identically on every transport.
    return (await fn(invocation)) ?? null;
  };
}
