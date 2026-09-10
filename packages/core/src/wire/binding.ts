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
  /**
   * `Answer<CanPublish>` — a question, and what this op answers goes back to whoever asked.
   * As many responders as there are, no law to combine them: the asker gets every answer
   * and decides, which is what `Pipe` had to avoid by admitting one.
   */
  | { kind: 'answer'; subjectName: string }
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

/** The three that name their own subject — `Fact`, `Pipe`, `Answer`. */
const ANNOUNCED = new Set(['Fact', 'Pipe', 'Answer']);

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

    // 0. What was announced or asked. All three name themselves, so nothing has to be
    //    known in advance, and they come FIRST because branch 4 would otherwise hand any
    //    of them the caller's input under the name of something that happened.
    const subject = ANNOUNCED.has(param.type.name) ? param.type.generics?.[0]?.name : undefined;
    if (subject) {
      const named = lowerFirst(subject);

      return {
        name: param.name,
        source: param.type.name === 'Answer'
          ? { kind: 'answer' as const, subjectName: named }
          : { kind: (param.type.name === 'Pipe' ? 'pipe' : 'fact') as 'pipe' | 'fact', factName: named },
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
