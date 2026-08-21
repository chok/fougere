/**
 * Where each parameter of an operation gets its value — decided once at boot from the
 * parsed signature, replayed per call by `resolveArgs`.
 *
 * The branches are ORDERED and each states why it sits where it does; the list used to
 * be repeated here too, and it had already lost `Fact` — the one whose position is
 * load-bearing, since the fall-through would otherwise hand it the caller's body.
 */
import type { ParsedParam } from '../scan/handler-parser.js';
import type { InvocationContext } from '../wire/invocation.js';
import { registrationKeyOf } from '@fougere/schema';

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
    // `registrationKeyOf`, never `toLowerCase()`: the collector set is keyed the way the
    // scan spells it, and the two agree on one word only — `AuthorUser` looked up as
    // `authoruser` missed `authorUser` and fell through to branch 4, the request body.
    const entityKey = registrationKeyOf(typeName);

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
    if (collectorEntityNames.has(entityKey)) {
      return {
        name: param.name,
        source: { kind: 'collector' as const, entityName: entityKey },
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
