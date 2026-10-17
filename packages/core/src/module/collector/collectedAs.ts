import { FieldValueValidator, dotted, json, type Entity, type Field, type SchemaView } from '@fougere/schema';
import { ErrorCode } from '../../wire/ErrorCode.js';
import { FougereError } from '../../wire/FougereError.js';

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
    reader = json(target as Entity);
    readers.set(target, reader);
  }

  const verdict = FieldValueValidator.of(reader).parse(value);
  if ('value' in verdict) return verdict.value;

  throw new FougereError({
    code: ErrorCode.VALIDATION_FAILED,
    message: `${collector.constructor.name}: ${verdict.path?.length ? `${dotted(verdict.path)}: ` : ''}${verdict.message}`,
  });
}
