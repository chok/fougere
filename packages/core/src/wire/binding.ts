/**
 * Where each parameter of an operation gets its value — decided once at boot from the parsed
 * signature, replayed per call by `resolveArgs`.
 */
import type { Param } from './Param.js';
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
  return params.map((param) => ({
    name: param.name,
    source: sourceOf(param, collectorTypeNames),
    optional: param.optional ?? false,
  }));
}

/**
 * Where ONE parameter gets its value, in the order the branches must be asked.
 *
 * A fact and a link name themselves, so they come FIRST: asked later, the last branch would hand
 * the caller's input under the name of something that happened.
 */
function sourceOf(param: Param, collectorTypeNames: Set<string>): ParamSource {
  const typeName = param.type.name;
  // `lowerFirst`, never `toLowerCase()`: the collector set is keyed the way the scan spells it,
  // and the two agree on one word only — `AuthorUser` looked up as `authoruser` missed
  // `authorUser` and fell through to the request input.
  const typeKey = lowerFirst(typeName);

  const announced = typeName === 'Fact' || typeName === 'Pipe' ? param.type.generics?.[0]?.name : undefined;
  if (announced) {
    return { kind: typeName === 'Pipe' ? 'pipe' : 'fact', factName: lowerFirst(announced) };
  }

  if (collectorTypeNames.has(typeKey)) return { kind: 'collector', typeName: typeKey };
  if (typeName === 'InvocationContext') return { kind: 'context' };
  if (PRIMITIVES.has(typeName)) return { kind: 'param', name: param.name, coerce: coercionFor(typeName) };

  return { kind: 'input' };
}
