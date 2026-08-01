/**
 * A value leaving the domain.
 *
 * Two things happen every time, in this order:
 *
 *   1. JUDGE — is this a legal value? Read from `shape` alone, so the answer does not
 *      depend on who is receiving. It has to come first: judging after the projection
 *      would fail on a client view that legitimately dropped its `writeOnly` fields.
 *   2. PROJECT — what may THIS receiver see? A client does not get a password hash;
 *      storage sees everything.
 *
 * Storage is a way out like the others. It used to be the exception — the ORM wrote
 * whatever a handler handed it, so `status: 'n-importe-quoi'` on a
 * `oneOf('draft','published')` was stored and read back unchanged (measured
 * 2026-07-25). The database is a weak judge: it catches nullability and, outside
 * SQLite, the column type — never a closed set, a format or a range, since the DDL
 * emits no CHECK. The choice was never "fail late or judge early", it was "corrupt
 * silently or judge early".
 *
 * What the judge must NOT read: `boundary` and `lifecycle`. Both answer "may a CLIENT
 * send this?", a question with no meaning when the domain itself is writing — reading
 * them here is exactly what makes `Post.validate(a_db_row)` come back invalid.
 *
 * Shallow, like `encodeFields` it stands on: a relation's nested rows are not reached.
 * A handler that hand-rolls its own envelope owns its own egress.
 */
import { checkValue, encodeFields, type Fields } from '@fougere/schema';
import { ErrorCode, FougereError } from './middleware.js';

// ─── 1 · Judge ──────────────────────────────────────────────

/**
 * Refuse a value the shape does not accept, before it goes anywhere.
 *
 * Only the keys actually present are judged, so a patch stays a patch: an update
 * naming one field says nothing about the others. A key with no field is not this
 * judge's business — the receiver fails on its own (an unknown column), and a client
 * input already met `validateFields`, which refuses strangers.
 */
export function judgeEgress(fields: Fields, value: unknown, entity: string, operation: string): void {
  if (typeof value !== 'object' || value === null) return;

  const errors: string[] = [];
  for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
    const field = fields[key];
    if (!field || item === undefined) continue;
    const checked = checkValue(field, item);
    if ('error' in checked) errors.push(`${key}: ${checked.error}`);
  }

  if (errors.length === 0) return;

  // The domain produced this, not a caller — so it is our bug, not a bad request,
  // and no retry with different input can fix it.
  throw new FougereError({
    code: ErrorCode.INTERNAL_ERROR,
    message: `Refused on the way out — ${errors.join(', ')}`,
    entity,
    operation,
    details: errors,
  });
}

// ─── 2 · Project ────────────────────────────────────────────

/**
 * An array's own non-index properties. `ListResult` IS an array — it carries
 * `hasMore`/`endCursor`/`total` on itself rather than wrapping the rows — so
 * mapping over it must not drop them.
 */
function arrayExtras(source: unknown[]): Record<string, unknown> {
  const extras: Record<string, unknown> = {};
  for (const key of Object.keys(source)) {
    if (!/^\d+$/.test(key)) extras[key] = (source as unknown as Record<string, unknown>)[key];
  }
  return extras;
}

/**
 * Drop what this receiver may not see — a `writeOnly` field goes here — then hand the
 * rest to `encodeFields`, which converts the values to their wire form.
 *
 * `closed` says the field set is the WHOLE of what this op emits, so anything else is
 * dropped. That is what naming a view for an op means (`Crud(Post, { list: PostCard })`):
 * the author states the audience, and a field they left out must not ride along. Open is
 * the default and stays the rule for the entity itself — a presenter's computed field is
 * an addition to the entity's output, not an intruder.
 */
export function projectEgress(fields: Fields, result: unknown, closed = false): unknown {
  if (result === null || result === undefined) return result;

  if (Array.isArray(result)) {
    const rows = result.map((item) => projectEgress(fields, item, closed));
    return Object.assign(rows, arrayExtras(result));
  }

  // A scalar (the boolean from `delete`, an id) crosses untouched.
  if (typeof result !== 'object') return result;

  const record = result as Record<string, unknown>;
  const scoped = closed
    ? Object.fromEntries(Object.keys(fields).filter((k) => k in record).map((k) => [k, record[k]]))
    : record;
  return encodeFields(fields, scoped);
}

// ─── 3 · Enrich ─────────────────────────────────────────────

/**
 * Add a presenter's computed fields — the last step out, after the projection.
 *
 * After, not before, for two reasons: a computed field is not an entity field, so
 * `encodeFields` has no boundary to apply to it; and it must not be dropped by the
 * projection, which keeps only what the entity declares.
 *
 * Skipped when the op names a view (`closed`): there the author stated exactly what
 * this audience gets, and an addition they did not list would contradict it. Open is
 * the default, and there a computed field is an addition to the entity's output, not
 * an intruder.
 *
 * It ran only in the REST and GraphQL projections before, each with its own copy — so
 * the same presenter answered on two doors and was silently absent from `useQuery`.
 * The cost travels with it: one computed field doing a read is one read per row.
 */
export async function presentEgress(
  result: unknown,
  presenter: Record<string, unknown> | undefined,
  fieldNames: string[] | undefined,
  entity = 'unknown',
  operation = 'unknown',
): Promise<unknown> {
  if (!presenter || !fieldNames?.length || result === null || typeof result !== 'object') return result;

  const enrich = async (item: unknown) => {
    if (item === null || typeof item !== 'object') return item;
    const enriched = { ...(item as Record<string, unknown>) };
    for (const name of fieldNames) {
      const fn = presenter[name];
      if (typeof fn !== 'function') continue;
      try {
        enriched[name] = await fn.call(presenter, item);
      } catch (cause) {
        // Now that this runs on every call, a throwing computed field would take the
        // whole operation down with a raw stack. Name the field instead: the domain
        // produced this, so it is our bug — same verdict `judgeEgress` renders.
        throw new FougereError({
          code: ErrorCode.INTERNAL_ERROR,
          message: `Computed field '${name}' failed: ${(cause as Error)?.message ?? cause}`,
          entity,
          operation,
          cause,
        });
      }
    }
    return enriched;
  };

  if (Array.isArray(result)) {
    // `ListResult` IS an array — carry its own properties across, like projectEgress.
    return Object.assign(await Promise.all(result.map(enrich)), arrayExtras(result));
  }
  return enrich(result);
}

// ─── The way out to storage ─────────────────────────────────

/** The writing ops — a read comes FROM storage, so it is not the domain emitting. */
interface Writer {
  create(...args: [Record<string, unknown>, ...unknown[]]): Promise<unknown>;
  update(...args: [unknown, Record<string, unknown>, ...unknown[]]): Promise<unknown>;
}

/**
 * The storage way out: judge, then hand over. There is no projection step — storage is
 * the receiver that sees everything, which is precisely why a `writeOnly` field can be
 * persisted while never reaching a browser.
 *
 * `Object.create` keeps the original on the prototype chain, so reads, `output()` and
 * whatever else an adapter carries still resolve, and a copy scoped later inherits the
 * judgement instead of escaping it.
 */
export function guardStorage<T extends object>(orm: T, fields: Fields, entityName: string): T {
  const base = orm as unknown as Writer;
  if (typeof base.create !== 'function' || typeof base.update !== 'function') return orm;

  const guarded = Object.create(orm) as T & Writer;

  // `async` on purpose: a refusal must REJECT the promise, not throw synchronously —
  // a sync throw from an awaited call skips every `.catch` the caller wrote.
  // Rest arguments, forwarded verbatim: an ORM must see the arity its caller used.
  guarded.create = async function (...args) {
    judgeEgress(fields, args[0], entityName, 'create');
    return base.create.apply(this, args);
  };

  guarded.update = async function (...args) {
    judgeEgress(fields, args[1], entityName, 'update');
    return base.update.apply(this, args);
  };

  return guarded;
}
