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

// ── Types ─────────────────────────────────────

export type ParamSource =
  | { kind: 'collector'; entityName: string }
  | { kind: 'param'; name: string; coerce?: 'number' | 'boolean' }
  | { kind: 'body' }
  | { kind: 'context' };

export interface ParamBinding {
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
      case 'body': {
        args.push(ctx.body);
        break;
      }
    }
  }

  return args;
}
