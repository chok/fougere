/**
 * Where each parameter of an operation gets its value — decided once at boot from the parsed
 * signature, replayed per call by `resolveArgs`.
 */
import type { Param } from './signature.js';
import { lowerFirst } from '@fougere/schema';

// ── Types ─────────────────────────────────────

type ParamSource =
  | { kind: 'collector'; typeName: string }
  /** `Fact<PostPublished>` — something that happened, not something a caller typed. */
  | { kind: 'fact'; factName: string }
  /**
   * `Pipe<PostPublished>` — the same thing, BEFORE it is final: what this op answers is
   * the fact every subscriber then receives. The core has one such link already
   * (`Emissions.stamped`, which realizes `created()`); this is the declared form of it.
   */
  | { kind: 'pipe'; factName: string }
  | { kind: 'param'; name: string; coerce?: 'number' | 'boolean' }
  | { kind: 'input' }
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

/** Build a BindingPlan from parsed method params. */
export function computeBindingPlan(
  params: Param[],
  collectorTypeNames: Set<string>,
): BindingPlan {
  return params.map((param) => {
    const typeName = param.type.name;
    // `lowerFirst`, never `toLowerCase()`: the collector set is keyed the way the
    // scan spells it, and the two agree on one word only — `AuthorUser` looked up as
    // `authoruser` missed `authorUser` and fell through to branch 4, the request input.
    const typeKey = lowerFirst(typeName);

    // 0. Fact, or the same fact before it is final. Both name themselves, so nothing has
    //    to be known in advance, and they come FIRST because branch 4 would otherwise hand
    //    either the caller's input under the name of something that happened.
    const announced = param.type.name === 'Fact' || param.type.name === 'Pipe'
      ? param.type.generics?.[0]?.name
      : undefined;
    if (announced) {
      return {
        name: param.name,
        source: {
          kind: (param.type.name === 'Pipe' ? 'pipe' : 'fact') as 'pipe' | 'fact',
          factName: lowerFirst(announced),
        },
        optional: param.optional ?? false,
      };
    }

    // 1. Collector — param type matches a type some collector answers for
    if (collectorTypeNames.has(typeKey)) {
      return {
        name: param.name,
        source: { kind: 'collector' as const, typeName: typeKey },
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

    // 4. Everything else — input
    return {
      name: param.name,
      source: { kind: 'input' as const },
      optional: param.optional ?? false,
    };
  });
}
