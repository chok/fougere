/**
 * The compensated realization of a frame — what `Together` becomes when its members do not share
 * an engine.
 */
import { FieldSet, type SchemaView } from '@fougere/schema';
import { dequal } from 'dequal';
import { declares } from '../../Source.js';
import type { Logger } from '../../builtin/Logger.js';
import { isChange, type Change } from '../../storage/Change.js';

/** One write that landed, and how to take it back. */
export interface Undo {
  /** What it will undo, in the sentence a failure report needs. */
  what: string;
  run(): Promise<void>;
}

/**
 * The subset of the port a frame has to watch: every gesture that writes, plus the reads that take
 * one back.
 */
interface Undoable {
  create(input: Record<string, unknown>, ...rest: unknown[]): Promise<Record<string, unknown>>;
  createAll?(inputs: readonly Record<string, unknown>[], ...rest: unknown[]): Promise<Record<string, unknown>[]>;
  update(id: string, patch: Record<string, unknown> | Change<Record<string, unknown>>, ...rest: unknown[]): Promise<Record<string, unknown>>;
  updateByKeys?(ids: readonly string[], change: Change<Record<string, unknown>>, ...rest: unknown[]): Promise<Map<string, Record<string, unknown>>>;
  delete(id: string): Promise<boolean>;
  findById(id: string, ...rest: unknown[]): Promise<Record<string, unknown> | undefined>;
  findByKeys(ids: readonly string[], ...rest: unknown[]): Promise<Map<string, Record<string, unknown>>>;
  upsert?(input: Record<string, unknown>, ...rest: unknown[]): Promise<Record<string, unknown>>;
  upsertAll?(inputs: readonly Record<string, unknown>[], ...rest: unknown[]): Promise<number>;
}

const pick = (row: Record<string, unknown>, keys: readonly string[]): Record<string, unknown> =>
  Object.fromEntries(keys.map((key) => [key, row[key]]));

/** Refused where it is used, naming the group that makes the inverse ambiguous. */
function refuseAmbiguousUpsert(entity: string, operation: string): never {
  throw new Error(
    `${entity}.${operation}() cannot be undone inside Together: ${entity} has a unique field besides its key, `
    + 'and this source has no transactions. Use create() or update() instead, or put the entities in one SQL source.',
  );
}

/**
 * The storage a member is handed inside a compensated frame: the same port, writing the same rows,
 * leaving an inverse behind each time.
 */
/** What one member's writes are recorded against, inside one frame. */
interface Recording {
  base: Undoable;
  recorded: Undoable;
  entity: string;
  key: string;
  journal: Undo[];
}

export function recording<T extends object>(storage: T, entity: string, schema: SchemaView, journal: Undo[]): T {
  const base = storage as unknown as Undoable;
  if (typeof base.create !== 'function' || typeof base.update !== 'function') return storage;

  const key = FieldSet.of(schema.getFields()).primary;
  if (!key) {
    throw new Error(
      `${entity} has no primary field, so its writes cannot be undone inside Together on this source. Add one: id: primary().`,
    );
  }

  const recorded = Object.create(storage) as T & Undoable;
  const into: Recording = { base, recorded, entity, key, journal };

  recordCreate(into);
  recordUpdate(into);
  recordUpdateByKeys(into);
  recordDelete(into);
  recordUpserts(into, schema);

  return recorded;
}

/** The inverse of an insertion is a deletion by the key the write handed back. */
function recordCreate({ base, recorded, entity, key, journal }: Recording): void {
  recorded.create = async function (...args) {
    const row = await base.create.apply(this, args);
    const id = String(row[key]);
    journal.push({ what: `create ${entity}#${id}`, run: () => base.delete.call(this, id).then(() => undefined) });

    return row;
  };

  const createAll = base.createAll;
  if (typeof createAll !== 'function') return;
  recorded.createAll = async function (...args) {
    const rows = await createAll.apply(this, args);
    for (const row of rows) {
      const id = String(row[key]);
      journal.push({ what: `create ${entity}#${id}`, run: () => base.delete.call(this, id).then(() => undefined) });
    }

    return rows;
  };
}

/**
 * Compared against what the WRITE produced, not against the patch: an `update: 'now'` field is
 * stamped by the storage, so the patch is not what the row now holds.
 */
function recordUpdate({ base, recorded, entity, journal }: Recording): void {
  recorded.update = async function (...args) {
    const [id, input] = args;
    let patch = isChange(input) ? {} : input;
    if (isChange(input)) {
      args[1] = async (current) => {
        patch = await input(current);

        return patch;
      };
    }
    const before = await base.findById.call(this, id);
    const row = await base.update.apply(this, args);
    if (before) journal.push(undoOf(base, this, entity, id, before, Object.keys(patch), row));

    return row;
  };
}

/** The same inverse, one per row a set of keys updated. */
function recordUpdateByKeys({ base, recorded, entity, key, journal }: Recording): void {
  const updateByKeys = base.updateByKeys;
  if (typeof updateByKeys !== 'function') return;

  recorded.updateByKeys = async function (ids, change, ...rest) {
    const patches = new Map<string, Record<string, unknown>>();
    const before = await base.findByKeys.call(this, ids);
    const rows = await updateByKeys.call(this, ids, async (current) => {
      const patch = await change(current);
      patches.set(String(current[key]), patch);

      return patch;
    }, ...rest);
    for (const [id, row] of rows) {
      const was = before.get(id);
      if (was) journal.push(undoOf(base, this, entity, id, was, Object.keys(patches.get(id) ?? {}), row));
    }

    return rows;
  };
}

function undoOf(
  base: Undoable,
  self: unknown,
  entity: string,
  id: string,
  before: Record<string, unknown>,
  touched: readonly string[],
  row: Record<string, unknown>,
): Undo {
  const wrote = pick(row, touched);

  return {
    what: `update ${entity}#${id} (${touched.join(', ')})`,
    run: async () => {
      const current = await base.findById.call(self, id);
      if (!current) throw new Error(`${entity}#${id} is gone`);
      // Reading and restoring are two statements, and there is no transaction here to make
      // them one — a write landing between them is overwritten unseen. So this names what it
      // FOUND, and claims nothing about what it did not: the frame was built because no
      // engine could isolate it, and a check does not put the isolation back.
      const moved = touched.filter((field) => !dequal(current[field], wrote[field]));
      if (moved.length > 0) {
        throw new Error(
          `${entity}#${id} was changed by someone else since Together wrote it (${moved.join(', ')}), `
          + 'so it is left as it is',
        );
      }
      await base.update.call(self, id, pick(before, touched));
    },
  };
}

/** Nothing to take back when the row was already gone. */
function recordDelete({ base, recorded, entity, journal }: Recording): void {
  recorded.delete = async function (id) {
    const before = await base.findById.call(this, id);
    const removed = await base.delete.call(this, id);
    if (removed && before) {
      journal.push({ what: `delete ${entity}#${id}`, run: () => base.create.call(this, before).then(() => undefined) });
    }

    return removed;
  };
}

/**
 * An upsert says neither what it wrote over nor what it inserted, so the frame reads the keys
 * first: what was there is restored, what was not is deleted. One extra query for the page,
 * the same bargain `update` already makes for one row.
 */
function recordUpserts({ base, recorded, entity, key, journal }: Recording, schema: SchemaView): void {
  const undoUpsert = async function (this: unknown, rows: readonly Record<string, unknown>[]): Promise<Undo> {
    const ids = rows.map((row) => String(row[key]));
    const before = await base.findByKeys.call(this, ids);

    return {
      what: `upsert ${entity} (${ids.length} row(s))`,
      run: async () => {
        for (const id of ids) {
          const was = before.get(id);
          if (was) await base.update.call(this, id, was);
          else await base.delete.call(this, id);
        }
      },
    };
  };

  const upsert = base.upsert;
  if (typeof upsert === 'function') {
    recorded.upsert = async function (input, ...rest) {
      if (declares(schema, 'unique')) refuseAmbiguousUpsert(entity, 'upsert');
      const undo = await undoUpsert.call(this, [input]);
      const row = await upsert.call(this, input, ...rest);
      journal.push(undo);

      return row;
    };
  }

  const upsertAll = base.upsertAll;
  if (typeof upsertAll === 'function') {
    recorded.upsertAll = async function (inputs, ...rest) {
      if (declares(schema, 'unique')) refuseAmbiguousUpsert(entity, 'upsertAll');
      const undo = await undoUpsert.call(this, inputs);
      const written = await upsertAll.call(this, inputs, ...rest);
      journal.push(undo);

      return written;
    };
  }
}

/** Replay the inverses, most recent first, and report rather than pretend. */
export async function unwind(journal: readonly Undo[], cause: unknown, log: Logger): Promise<never> {
  const stuck: string[] = [];
  for (const undo of [...journal].reverse()) {
    try {
      await undo.run();
    } catch (failure) {
      stuck.push(`${undo.what} — ${(failure as Error).message}`);
      log.error(`Together could not undo ${undo.what}`, failure);
    }
  }
  if (stuck.length === 0) throw cause;

  throw new Error(
    `Together failed, and ${stuck.length} of ${journal.length} write(s) could not be undone and stay in the database: `
    + `${stuck.join('; ')}. The failure was: ${(cause as Error)?.message ?? String(cause)}`,
    { cause },
  );
}
