import { FieldValueValidator, dotted, json, type Field } from '@fougere/schema';
import { ErrorCode } from '../../wire/ErrorCode.js';
import { FougereError } from '../../wire/FougereError.js';
import { targetOf } from '../../prefab/prefab.js';

const readers = new WeakMap<object, Field>();

/**
 * What a collector answered, read by the entity it names — judged and rebuilt, so a `User` that
 * crossed a process as JSON reaches the handler with its dates. A collector naming no entity
 * answers what it built.
 */
export function collectedAs(collector: object, value: unknown): unknown {
  const target = targetOf(collector.constructor);
  if (value === null || value === undefined || typeof target?.getFields !== 'function') return value;

  let reader = readers.get(target);
  if (!reader) {
    reader = json(target);
    readers.set(target, reader);
  }

  const parsed = FieldValueValidator.of(reader).parse(value);
  if ('value' in parsed) return parsed.value;

  throw new FougereError({
    code: ErrorCode.VALIDATION_FAILED,
    message: `${collector.constructor.name}: ${parsed.path?.length ? `${dotted(parsed.path)}: ` : ''}${parsed.message}`,
  });
}
