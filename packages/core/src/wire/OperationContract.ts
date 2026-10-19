import type { SchemaView } from '@fougere/schema';
import type { BindingPlan } from './binding.js';
import type { Signature } from './Signature.js';
import type { TypeRef } from './TypeRef.js';
import type { ErrorCode } from './ErrorCode.js';
import type { OperationKind } from './OperationKind.js';
import { Verbs } from './Verbs.js';
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
 * An operation reads when its name says so: every verb it names — the first word, and each word
 * after `and`, `or` or `then` — is a read verb. Anything else is a command, which promises nothing:
 * a read taken for a command still answers, a command taken for a read would be cached.
 *
 * Documented: [business logic](https://fougere.dev/docs/guides/business-logic).
 */
export function inferOperationKind(name: string): OperationKind {
  const words = wordsOf(name);
  const verbs = words.filter((_, at) => at === 0 || COMPOUND_CONNECTORS.has(words[at - 1]!));

  return verbs.length > 0 && verbs.every((verb) => Verbs.find(verb) === 'query') ? 'query' : 'command';
}
