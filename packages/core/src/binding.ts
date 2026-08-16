/**
 * Binding — unified parameter resolution for handler operations.
 *
 * A BindingPlan is computed once at boot from parsed method signatures.
 * At call time, resolveArgs() produces the argument array from an InvocationContext.
 *
 * Algorithm (by param type):
 * 1. Collector entity type → resolved via Collector.collect(ctx)
 * 2. InvocationContext → the context itself
 * 3. Primitive (string, number, boolean) → matched by name from params then query
 * 4. Object/entity type → matched from body
 */
import type { ParsedParam } from './handler-parser.js';
import type { InvocationContext } from './invocation.js';
import { registrationKeyOf } from './contract.js';

// ── Types ─────────────────────────────────────

type ParamSource =
  | { kind: 'collector'; entityName: string }
  /**
   * `Fact<PostPublished>` — something that happened, not something a caller typed.
   *
   * It resolves from the body exactly like `body` does, and that is deliberate: an
   * emission and a direct call ARE the same call, so a subscriber cannot tell them apart
   * and does not need to. The branch exists so the PLAN says what this parameter is —
   * that sentence is what makes the subscriber index readable without reparsing types.
   */
  | { kind: 'fact'; factName: string }
  | { kind: 'param'; name: string; coerce?: 'number' | 'boolean' }
  | { kind: 'body' }
  | { kind: 'context' }
  /** The whole query bag, for an op whose argument IS the options (list). */
  | { kind: 'query' };

interface ParamBinding {
  name: string;
  source: ParamSource;
  optional: boolean;
}

export type BindingPlan = ParamBinding[];

// ── Primitives ────────────────────────────────

const PRIMITIVES = new Set(['string', 'number', 'boolean']);

function coercionFor(typeName: string): 'number' | 'boolean' | undefined {
  if (typeName === 'number') return 'number';
  if (typeName === 'boolean') return 'boolean';
  return undefined;
}

// ── Compute ───────────────────────────────────

/**
 * Build a BindingPlan from parsed method params.
 *
 * @param params - Parsed parameter list from AST
 * @param collectorEntityNames - Set of entity names that have a Collector
 */
export function computeBindingPlan(
  params: ParsedParam[],
  collectorEntityNames: Set<string>,
): BindingPlan {
  return params.map((param) => {
    const typeName = param.type.name;
    const typeNameLower = typeName.toLowerCase();

    // 0. Fact — `Fact<X>` names itself, so nothing has to be known in advance. It comes
    //    FIRST because branch 4 would otherwise hand it the caller's body under the name
    //    of something that happened.
    const factOf = param.type.name === 'Fact' ? param.type.generics?.[0]?.name : undefined;
    if (factOf) {
      return {
        name: param.name,
        source: { kind: 'fact' as const, factName: registrationKeyOf(factOf) },
        optional: param.optional ?? false,
      };
    }

    // 1. Collector — param type matches a known collector entity
    if (collectorEntityNames.has(typeNameLower)) {
      return {
        name: param.name,
        source: { kind: 'collector' as const, entityName: typeNameLower },
        optional: param.optional ?? false,
      };
    }

    // 2. InvocationContext — inject the full context
    if (typeName === 'InvocationContext') {
      return {
        name: param.name,
        source: { kind: 'context' as const },
        optional: param.optional ?? false,
      };
    }

    // 3. Primitives — matched by name from params > query
    if (PRIMITIVES.has(typeName)) {
      return {
        name: param.name,
        source: {
          kind: 'param' as const,
          name: param.name,
          coerce: coercionFor(typeName),
        },
        optional: param.optional ?? false,
      };
    }

    // 4. Everything else — body
    return {
      name: param.name,
      source: { kind: 'body' as const },
      optional: param.optional ?? false,
    };
  });
}

// ── Resolve ───────────────────────────────────

export interface CollectorResolver {
  collect(ctx: InvocationContext): Promise<unknown>;
}

/**
 * Resolve handler arguments from a BindingPlan + InvocationContext.
 */
export async function resolveArgs(
  plan: BindingPlan,
  ctx: InvocationContext,
  resolveCollector?: (entityName: string) => CollectorResolver | undefined,
): Promise<unknown[]> {
  const args: unknown[] = [];

  for (const binding of plan) {
    switch (binding.source.kind) {
      case 'collector': {
        const collector = resolveCollector?.(binding.source.entityName);
        args.push(collector ? await collector.collect(ctx) : undefined);
        break;
      }
      case 'context': {
        args.push(ctx);
        break;
      }
      case 'param': {
        let val: unknown = ctx.params[binding.source.name] ?? ctx.query[binding.source.name];
        if (val != null && binding.source.coerce === 'number') val = Number(val);
        if (val != null && binding.source.coerce === 'boolean') val = val === 'true' || val === '1' || val === true;
        args.push(val);
        break;
      }
      case 'fact': {
        // A fact IS the payload — the whole of what happened, never a piece of it.
        // Identical to `body` today, and deliberately not sharing its branch: the two
        // agree by coincidence, not by rule, and the day `body` learns to look up a
        // value by parameter name a subscriber would receive ONE FIELD of the fact it
        // subscribed to. Splitting it costs nothing and removes that trap.
        args.push(ctx.body);
        break;
      }
      case 'body': {
        args.push(ctx.body);
        break;
      }
      case 'query': {
        args.push(ctx.query);
        break;
      }
    }
  }

  return args;
}
