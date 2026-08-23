/** Storage egress is judged before it reaches an adapter. Client projection lives in dispatch. */
import { Judge, type Fields } from '@fougere/schema';
import { ErrorCode, FougereError } from '../wire/errors.js';
import { assertListOptions } from '../orm.js';
import { OutputProjector } from '../dispatch/OutputProjector.js';
import { PresenterExecutor, type PresenterArgs } from '../dispatch/PresenterExecutor.js';

/**
 * Judge only fields present in the value. Boundary and lifecycle rules are client-input
 * concerns and deliberately do not participate in a domain write.
 */
function judgeEgress(fields: Fields, value: unknown, entity: string, operation: string): void {
  if (typeof value !== 'object' || value === null) return;

  const errors: string[] = [];
  for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
    const field = fields[key];
    if (!field || item === undefined) continue;
    const checked = Judge.value(field, item);
    if ('error' in checked) errors.push(`${key}: ${checked.error}`);
  }

  if (errors.length === 0) return;

  throw new FougereError({
    code: ErrorCode.INTERNAL_ERROR,
    message: `Refused on the way out — ${errors.join(', ')}`,
    entity,
    operation,
    details: errors,
  });
}

/** Compatibility function while call sites move to OutputProjector. */
export function projectEgress(fields: Fields, result: unknown, closed = false): unknown {
  return new OutputProjector(fields, closed).project(result);
}

export type { PresenterArgs } from '../dispatch/PresenterExecutor.js';

/** Compatibility function while call sites move to PresenterExecutor. */
export async function presentEgress(
  result: unknown,
  presenter: Record<string, unknown> | undefined,
  fieldNames: string[] | undefined,
  entity = 'unknown',
  operation = 'unknown',
  args: PresenterArgs = {},
): Promise<unknown> {
  return new PresenterExecutor(presenter, fieldNames, entity, operation).present(result, args);
}

/** The writing ops — a read comes FROM storage, so it is not the domain emitting. */
interface Writer {
  create(...args: [Record<string, unknown>, ...unknown[]]): Promise<unknown>;
  update(...args: [unknown, Record<string, unknown>, ...unknown[]]): Promise<unknown>;
}

/** Judge writes while preserving the complete ORM interface through its prototype. */
export function guardStorage<T extends object>(orm: T, fields: Fields, entityName: string): T {
  const base = orm as unknown as Writer;
  if (typeof base.create !== 'function' || typeof base.update !== 'function') return orm;

  const guarded = Object.create(orm) as T & Writer;

  // Async keeps refusals on the ORM's promise boundary.
  guarded.create = async function (...args) {
    judgeEgress(fields, args[0], entityName, 'create');
    return base.create.apply(this, args);
  };

  guarded.update = async function (...args) {
    judgeEgress(fields, args[1], entityName, 'update');
    return base.update.apply(this, args);
  };

  // Unknown list options must be refused instead of silently widening the query.
  const reader = orm as unknown as { list?: (...args: unknown[]) => unknown };
  if (typeof reader.list === 'function') {
    (guarded as unknown as typeof reader).list = async function (...args: unknown[]) {
      assertListOptions(args[0] as object | undefined, entityName);
      return (reader.list as Function).apply(this, args);
    };
  }

  return guarded;
}
