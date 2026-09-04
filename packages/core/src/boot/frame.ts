/** The compensated realization of a frame — what `Together` becomes when its members do not share an… */
import { FieldGroup, FieldSet, Unique, type Fields } from '@fougere/schema';
import { dequal } from 'dequal';
import type { Logger } from '../builtin/logger.js';

/** One write that landed, and how to take it back. */
export interface Undo {
  /** What it will undo, in the sentence a failure report needs. */
  what: string;
  run(): Promise<void>;
}

/** The subset of the port a frame has to watch: */
interface Undoable {
  create(input: Record<string, unknown>, ...rest: unknown[]): Promise<Record<string, unknown>>;
  update(id: string, patch: Record<string, unknown>, ...rest: unknown[]): Promise<Record<string, unknown>>;
  delete(id: string): Promise<boolean>;
  findById(id: string, ...rest: unknown[]): Promise<Record<string, unknown> | undefined>;
  findByKeys(ids: readonly string[], ...rest: unknown[]): Promise<Map<string, Record<string, unknown>>>;
  upsert?(input: Record<string, unknown>, ...rest: unknown[]): Promise<Record<string, unknown>>;
  upsertAll?(inputs: readonly Record<string, unknown>[], ...rest: unknown[]): Promise<number>;
}

const pick = (row: Record<string, unknown>, keys: readonly string[]): Record<string, unknown> =>
  Object.fromEntries(keys.map((key) => [key, row[key]]));

/** Whether an upsert's conflict can be something other than the primary key. */
function mayConflictElsewhere(fields: Fields): boolean {
  const groups = FieldGroup.groupsOf(fields, Unique);
  if (groups.length > 0) return true;
  // A sole `unique()` carries a one-member group, which `groupsOf` filters out.
  return Object.values(fields).some((field) => FieldGroup.on(field, Unique).length > 0);
}

/** Refused where it is used, naming the group that makes the inverse ambiguous. */
function refuseAmbiguousUpsert(entity: string, gesture: string): never {
  throw new Error(
    `${entity}.${gesture}() cannot be unwound: ${entity} declares a unique constraint besides ` +
    `its key, so an upsert may overwrite a row this frame never read — and there is no ` +
    `transaction here to take it back. Put the members in one source, or write ` +
    `create/update explicitly.`,
  );
}

/** The storage a member is handed inside a compensated frame: */
export function recording<T extends object>(storage: T, entity: string, fields: Fields, journal: Undo[]): T {
  const base = storage as unknown as Undoable;
  if (typeof base.create !== 'function' || typeof base.update !== 'function') return storage;

  const key = FieldSet.of(fields).primary;
  if (!key) {
    throw new Error(
      `${entity} declares no primary field, so a write to it cannot be taken back by ` +
      `identity — and this frame has no transaction to do it instead.`,
    );
  }

  const recorded = Object.create(storage) as T & Undoable;

  recorded.create = async function (...args) {
    const row = await base.create.apply(this, args);
    const id = String(row[key]);
    journal.push({ what: `create ${entity}#${id}`, run: () => base.delete.call(this, id).then(() => undefined) });
    return row;
  };

  recorded.update = async function (...args) {
    const [id, patch] = args;
    const before = await base.findById.call(this, id);
    const row = await base.update.apply(this, args);
    if (!before) return row;

    // Compare against what the WRITE produced, not against the patch: a `update: 'now'`
    // field is stamped by the storage, so the patch is not what the row now holds.
    const touched = Object.keys(patch);
    const wrote = pick(row, touched);
    journal.push({
      what: `update ${entity}#${id} (${touched.join(', ')})`,
      run: async () => {
        const current = await base.findById.call(this, id);
        if (!current) throw new Error(`${entity}#${id} is gone`);
        const moved = touched.filter((field) => !dequal(current[field], wrote[field]));
        if (moved.length > 0) {
          throw new Error(`${entity}#${id} was changed by someone else since (${moved.join(', ')})`);
        }
        await base.update.call(this, id, pick(before, touched));
      },
    });
    return row;
  };

  recorded.delete = async function (id) {
    const before = await base.findById.call(this, id);
    const removed = await base.delete.call(this, id);
    if (removed && before) {
      journal.push({ what: `delete ${entity}#${id}`, run: () => base.create.call(this, before).then(() => undefined) });
    }
    return removed;
  };

  // An upsert says neither what it wrote over nor what it inserted, so the frame reads the
  // keys first: what was there is restored, what was not is deleted. One extra query for
  // the page, which is the same bargain `update` already makes for one row.
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

  if (typeof base.upsert === 'function') {
    recorded.upsert = async function (input, ...rest) {
      if (mayConflictElsewhere(fields)) refuseAmbiguousUpsert(entity, 'upsert');
      const undo = await undoUpsert.call(this, [input]);
      const row = await base.upsert!.call(this, input, ...rest);
      journal.push(undo);
      return row;
    };
  }

  if (typeof base.upsertAll === 'function') {
    recorded.upsertAll = async function (inputs, ...rest) {
      if (mayConflictElsewhere(fields)) refuseAmbiguousUpsert(entity, 'upsertAll');
      const undo = await undoUpsert.call(this, inputs);
      const written = await base.upsertAll!.call(this, inputs, ...rest);
      journal.push(undo);
      return written;
    };
  }

  return recorded;
}

/** Replay the inverses, most recent first, and report rather than pretend. */
export async function unwind(journal: readonly Undo[], cause: unknown, log: Logger): Promise<never> {
  const stuck: string[] = [];
  for (const undo of [...journal].reverse()) {
    try {
      await undo.run();
    } catch (failure) {
      stuck.push(`${undo.what} — ${(failure as Error).message}`);
      log.error(`frame could not undo ${undo.what}`, failure);
    }
  }
  if (stuck.length === 0) throw cause;

  throw new Error(
    `The frame failed and ${stuck.length} of ${journal.length} write(s) could not be taken back: ` +
    `${stuck.join('; ')}. What remains is in the database. Original failure: ` +
    `${(cause as Error)?.message ?? String(cause)}`,
    { cause },
  );
}
