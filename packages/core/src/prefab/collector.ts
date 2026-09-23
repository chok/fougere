/**
 * Collector(Type) — resolves one handler input parameter from the invocation context.
 *
 * Documented: [collectors](https://fougere.dev/docs/business/collectors).
 */

import { FieldValueValidator, dotted, json, upperFirst, type Field, type SchemaView } from '@fougere/schema';
import { ErrorCode } from '../wire/ErrorCode.js';
import { FougereError } from '../wire/FougereError.js';

export function Collector<T extends abstract new (...args: any[]) => any>(target: T) {
  class CollectorBase {
    static readonly __entity = target;
  }

  return CollectorBase;
}

/** Container key of a collector — 'user' → 'UserCollector', 'ability' → 'AbilityCollector'. */
export function collectorKeyOf(type: string): string {
  return `${upperFirst(type)}Collector`;
}

const readers = new WeakMap<object, Field>();

/**
 * What a collector answered, read by the entity it names — judged and rebuilt, so a `User` that
 * crossed a process as JSON reaches the handler with its dates. A collector naming no entity
 * answers what it built.
 */
export function collectedAs(collector: object, value: unknown): unknown {
  const target = (collector.constructor as { __entity?: Partial<SchemaView> }).__entity;
  if (value === null || value === undefined || typeof target?.getFields !== 'function') return value;

  let reader = readers.get(target);
  if (!reader) {
    reader = json(target as SchemaView & (new () => unknown));
    readers.set(target, reader);
  }

  const verdict = FieldValueValidator.of(reader).parse(value);
  if ('value' in verdict) return verdict.value;

  throw new FougereError({
    code: ErrorCode.VALIDATION_FAILED,
    message: `${collector.constructor.name}: ${verdict.path?.length ? `${dotted(verdict.path)}: ` : ''}${verdict.message}`,
  });
}
