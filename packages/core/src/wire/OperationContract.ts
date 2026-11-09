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
  /** The refusals this operation can reach, walked from every `throw` upward; the framework's are not here. */
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
 * An operation reads when every verb its name uses is a read verb; anything else is a command.
 * Ex: `listAndCount` reads, `listAndPurge` is a command.
 *
 * Documented: [business logic](https://fougere.dev/tutorial/3-a-rule).
 */
export function inferOperationKind(name: string): OperationKind {
  const words = wordsOf(name);
  const verbs = words.filter((_, at) => at === 0 || COMPOUND_CONNECTORS.has(words[at - 1]!));

  return verbs.length > 0 && verbs.every((verb) => Verbs.find(verb) === 'query') ? 'query' : 'command';
}
