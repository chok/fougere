/**
 * Check a value before it reaches storage.
 *
 * The façade judges what a CLIENT sends. Nothing judged what a HANDLER writes — so a
 * handler could store `status: 'n-importe-quoi'` on a `oneOf('draft','published')`, and
 * read it back unchanged (measured 2026-07-25). The database is a weak judge: it catches
 * nullability and, outside SQLite, the column type — never a closed set, a format or a
 * range, since the DDL emits no CHECK. The choice was never "fail late or judge early",
 * it was "corrupt silently or judge early".
 *
 * This reads `shape` and NOTHING else. Not `boundary`, not `lifecycle` — those answer
 * "may a client send this?", a question with no meaning when the domain itself is
 * writing. Judging with them here is exactly what makes `Post.validate(a_db_row)` come
 * back invalid.
 *
 * Only the keys actually present are judged, so a patch stays a patch: `update(id,
 * { status })` says nothing about the fields it does not mention.
 */
import { checkValue, type Fields, type SchemaLike } from '@fougere/schema';
import { ErrorCode, FougereError } from './middleware.js';

/**
 * The two writing ops — reads come from storage and are not the domain's emission.
 * Rest arguments on purpose: forwarding them verbatim keeps the arity a caller sees,
 * so an ORM that behaves differently on `create(x)` and `create(x, undefined)` is not
 * silently handed a second argument it never got.
 */
interface Writer {
  create(...args: [Record<string, unknown>, ...unknown[]]): Promise<unknown>;
  update(...args: [unknown, Record<string, unknown>, ...unknown[]]): Promise<unknown>;
}

function judge(fields: Fields, input: unknown, entity: string, operation: string): void {
  if (typeof input !== 'object' || input === null) return;

  const errors: string[] = [];
  for (const [key, value] of Object.entries(input as Record<string, unknown>)) {
    const field = fields[key];
    // A key with no field is not this judge's business — the ORM will fail on an
    // unknown column, and the façade already refuses unknown keys from a client.
    if (!field || value === undefined) continue;
    const checked = checkValue(field, value);
    if ('error' in checked) errors.push(`${key}: ${checked.error}`);
  }

  if (errors.length === 0) return;

  // A handler wrote this, not a client — so it is our bug, not a bad request, and no
  // caller can fix it by retrying with different input.
  throw new FougereError({
    code: ErrorCode.INTERNAL_ERROR,
    message: `Refused before writing to storage — ${errors.join(', ')}`,
    entity,
    operation,
    details: errors,
  });
}

/**
 * Wrap an ORM so `create` and `update` judge their values first.
 *
 * `Object.create` keeps the original on the prototype chain, so everything else — reads,
 * `output()` and whatever an adapter adds — still resolves, and a scoped copy taken
 * later inherits the checks instead of escaping them.
 */
export function judgeOnWrite<T extends object>(orm: T, entity: SchemaLike, entityName: string): T {
  const fields = entity.getFields();
  const base = orm as unknown as Writer;
  if (typeof base.create !== 'function' || typeof base.update !== 'function') return orm;

  const judged = Object.create(orm) as T & Writer;

  // `async` on purpose: a refusal must REJECT the promise, not throw synchronously.
  // A sync throw from an awaited call skips every `.catch` the caller wrote.
  judged.create = async function (...args) {
    judge(fields, args[0], entityName, 'create');
    return base.create.apply(this, args);
  };

  judged.update = async function (...args) {
    judge(fields, args[1], entityName, 'update');
    return base.update.apply(this, args);
  };

  return judged;
}
