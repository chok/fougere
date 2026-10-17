import type { SchemaView } from '@fougere/schema';
import type { BindingPlan } from './binding.js';
import type { Signature } from './Signature.js';
import type { TypeRef } from './TypeRef.js';
import type { ErrorCode } from './ErrorCode.js';
import type { OperationKind } from './OperationKind.js';
import { Verbs } from './Verbs.js';
import type { OperationKindInference } from './OperationKindInference.js';
import type { Cardinality } from './Cardinality.js';

/** The contract of one operation — everything the façade needs to serve a call. */
export interface OperationContract {
  /** Judged on the way in. The view carries its own mode (`partial()` → patch). */
  input?: SchemaView;
  /** Projected on the way out. */
  output?: SchemaView;
  /** Where each argument is read from in the invocation. */
  binding?: BindingPlan;
  /** The operation in words, for a caller that meets it over the wire and has to choose. */
  description?: string;
  /** How MUCH comes back — the half of the return type that `output` cannot say. */
  cardinality?: Cardinality;
  /** The argument names and TYPES — the one thing `binding` cannot say. */
  signature?: Signature;
  /**
   * The refusals a path from this operation can reach, walked from every `throw` upward.
   *
   * What the FRAMEWORK refuses is not here: `VALIDATION_FAILED` follows from `input`,
   * `SERVICE_UNAVAILABLE` from being dispatched at all, the gateway pair from a remote
   * placement — all already on the card, so listing them per op would write one fact twice.
   * `refusalsOf` puts the two halves together for whoever reads.
   */
  errors?: ErrorCode[];
}

/** Read an op's cardinality off its parsed return type. */
export function cardinalityOf(type: TypeRef | undefined): OperationContract['cardinality'] {
  if (!type) return undefined;
  const inner = type.name === 'Promise' ? type.generics?.[0] : type;
  if (!inner) return 'none';
  if (inner.name === 'Page' || inner.name === 'ListResult') return 'page';
  if (inner.array) return 'many';
  if (PRIMITIVE_RETURNS.has(inner.name)) return 'none';

  return inner.nullable || inner.undefined ? 'maybe' : 'one';
}

/** A return that carries no schema — the card has nothing to project onto it. */
const PRIMITIVE_RETURNS = new Set(['boolean', 'string', 'number', 'void', 'undefined', 'unknown', 'any']);

const COMPOUND_CONNECTORS = new Set(['and', 'or', 'then']);

/** The verbs of each kind, for a refusal that has to say what a name could have led with. */
export function knownVerbs(): { query: string[]; command: string[] } {
  const of = (kind: OperationKind) => Verbs.entries.filter(([, told]) => told === kind).map(([verb]) => verb).sort();

  return { query: of('query'), command: of('command') };
}

/** `getOrCreatePost` → `['get', 'or', 'create', 'post']`; `hash` never becomes `has`. */
export function wordsOf(name: string): string[] {
  return name
    .replace(/([a-z\d])([A-Z])/g, '$1 $2')
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2')
    .split(/[^A-Za-z\d]+/)
    .filter(Boolean)
    .map((word) => word.toLowerCase());
}

/**
 * Infer only when the leading word names one convention and a composed clause does not name the
 * opposite one.
 */
export function inferOperationKind(name: string): OperationKindInference {
  const words = wordsOf(name);
  const first = words[0];
  const primary = first ? Verbs.find(first) : undefined;

  if (!primary) return { kind: undefined, queryMatches: [], commandMatches: [] };

  const queryMatches = primary === 'query' ? [first] : [];
  const commandMatches = primary === 'command' ? [first] : [];
  for (let i = 1; i < words.length; i++) {
    if (!COMPOUND_CONNECTORS.has(words[i - 1])) continue;
    const told = Verbs.find(words[i]!);
    if (told === 'query') queryMatches.push(words[i]!);
    if (told === 'command') commandMatches.push(words[i]!);
  }

  return {
    kind: queryMatches.length > 0 && commandMatches.length === 0
      ? 'query'
      : commandMatches.length > 0 && queryMatches.length === 0
        ? 'command'
        : undefined,
    queryMatches,
    commandMatches,
  };
}

/** Explicit config is authoritative; otherwise the finite convention may decline. */
function resolveOperationKind(
  name: string,
  overrides?: Record<string, { kind?: OperationKind }>,
): OperationKind | undefined {
  return overrides?.[name]?.kind ?? inferOperationKind(name).kind;
}

/**
 * Compatibility for boolean readers. An indeterminate name throws: returning `false`
 * here would recreate the silent command fallback this module exists to prevent.
 */
export function isReadOp(name: string): boolean {
  return requireOperationKind(name) === 'query';
}

/** Resolve an explicit/conventional kind for existing adapters, never by fallback. */
export function resolveIsReadOp(
  name: string,
  overrides?: Record<string, { kind?: OperationKind }>,
): boolean {
  return requireOperationKind(name, overrides) === 'query';
}

function requireOperationKind(
  name: string,
  overrides?: Record<string, { kind?: OperationKind }>,
): OperationKind {
  const kind = resolveOperationKind(name, overrides);
  if (kind) return kind;
  throw new Error(
    `Cannot infer operation kind from '${name}'. State it in frond.config.ts — `
    + `operations: { '<address>.${name}': { kind: 'query' } } — or teach the verb in the frond's vocabulary/.`,
  );
}
