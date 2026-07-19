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

/** What an app hosts — the wire projection of its scanned fronds. */
export interface IdentityCard {
  fronds: Array<{
    name: string;
    entities: Array<{
      name: string;
      ops: string[];
      schema: unknown;
    }>;
  }>;
}

type Facade = Record<string, (invocation?: InvocationContext) => Promise<unknown>>;

/** Serialize what the app hosts. Served on `rpc.discover`, cached by callers. */
export function identityCardOf(app: App): IdentityCard {
  return {
    fronds: app.fronds.map((frond) => ({
      name: frond.name,
      entities: frond.entities.map((entity) => ({
        name: entity.name,
        ops: facadeOps(app, entity.name),
        schema: describeSchema(entity.entityClass, entity.name),
      })),
    })),
  };
}

function facadeOps(app: App, entityName: string): string[] {
  try {
    return Object.keys(app.container.resolve<Facade>(`${entityName}Handler`));
  } catch {
    return [];
  }
}

/**
 * Build the local runner — the reference realization of Transport.
 *
 * Resolves strictly from the app's own container: a call that lands here is
 * judged here. A miss is a typed NOT_FOUND, never a forward to another remote.
 */
export function createLocalRunner(app: App): Transport {
  return runnerFor(app, (key) => app.container.resolve<Facade>(key));
}

/**
 * Build the app runner — same judgment, but resolution follows the app's
 * topology: local façades and remote doublures alike. This is the runner
 * an app's own entry points (browser endpoint, bridges) stand on.
 */
export function createAppRunner(app: App): Transport {
  return runnerFor(app, (key) => app.resolve<Facade>(key));
}

function runnerFor(app: App, resolveFacade: (key: string) => Facade): Transport {
  return async (call, invocation) => {
    if (call.entity === RPC_ENTITY) {
      if (call.op === 'discover') return identityCardOf(app);
      throw new FougereError({
        code: ErrorCode.NOT_FOUND,
        message: `Unknown rpc operation '${call.op}'`,
        entity: RPC_ENTITY,
        operation: call.op,
      });
    }

    let facade: Facade;
    try {
      facade = resolveFacade(`${call.entity}Handler`);
    } catch {
      throw new FougereError({
        code: ErrorCode.NOT_FOUND,
        message: `Entity '${call.entity}' is not hosted here`,
        entity: call.entity,
        operation: call.op,
      });
    }

    const fn = facade[call.op];
    if (typeof fn !== 'function') {
      throw new FougereError({
        code: ErrorCode.NOT_FOUND,
        message: `Unknown operation '${call.op}' on '${call.entity}'`,
        entity: call.entity,
        operation: call.op,
      });
    }
    // A call's result is JSON-shaped: undefined has no wire form, it
    // normalizes to null at the contract edge — identically on every transport.
    return (await fn(invocation)) ?? null;
  };
}
