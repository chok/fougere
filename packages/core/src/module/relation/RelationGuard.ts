import { ErrorCode } from '../../wire/ErrorCode.js';
import { FougereError } from '../../wire/FougereError.js';
import type { RelationCheck } from './RelationCheck.js';
import { isChange, type Change } from '../../storage/Change.js';
import { beingReleased, release, type Releasing } from './Release.js';
import { markOf } from './FougereTarget.js';

/** The gestures a relation reads before they land. */
export interface Writer {
  create(...args: [Record<string, unknown>, ...unknown[]]): Promise<unknown>;
  createAll?(...args: [readonly Record<string, unknown>[], ...unknown[]]): Promise<unknown>;
  update(...args: [unknown, Record<string, unknown> | Change<Record<string, unknown>>, ...unknown[]]): Promise<unknown>;
  updateByKeys?(...args: [readonly string[], Change<Record<string, unknown>>, ...unknown[]]): Promise<unknown>;
  upsert?(...args: [Record<string, unknown>, ...unknown[]]): Promise<unknown>;
  upsertAll?(...args: [readonly Record<string, unknown>[], ...unknown[]]): Promise<unknown>;
  delete?(id: string): Promise<boolean>;
}

/** A unit of work holding these marks, handed the entity's rows bound to it. */
export type Holding = <R>(marks: readonly string[], write: (rows: Writer) => Promise<R>) => Promise<R>;

/** What a `ref()` asks of a storage: its targets read before a write lands, and what names a row released before the row goes. */
export class RelationGuard {
  constructor(
    private readonly entity: string,
    private readonly relations: readonly RelationCheck[] = [],
    private readonly releasing?: Releasing,
    private readonly holding?: Holding,
  ) {}

  guard<T extends object>(storage: T): T {
    const writer = storage as unknown as Writer;
    if (this.relations.length === 0 && !this.releasing) return storage;
    if (typeof writer.create !== 'function' || typeof writer.update !== 'function') return storage;

    const guarded = Object.create(storage) as T & Writer;
    this.guardDelete(guarded, writer);
    if (this.relations.length > 0) this.guardWrites(guarded, writer);

    return guarded;
  }

  private guardDelete(guarded: Writer, writer: Writer): void {
    const remove = writer.delete;
    if (typeof remove !== 'function' || !this.releasing) return;

    const checking = this;
    guarded.delete = async function (id) {
      if (beingReleased(checking.entity, id)) return remove.call(this, id);
      let gone = false;
      await release(checking.entity, id, checking.releasing!, [], async () => {
        gone = await remove.call(this, id);
      });

      return gone;
    };
  }

  private guardWrites(guarded: Writer, writer: Writer): void {
    const checking = this;

    guarded.create = async function (...args) {
      return checking.landing([args[0]], 'create', () => writer.create.apply(this, args), (rows) => rows.create(...args));
    };

    guarded.update = async function (...args) {
      const input = args[1];
      if (isChange(input)) {
        args[1] = async (current) => {
          const patch = await input(current);
          await checking.targetsOf([patch], 'update');

          return patch;
        };

        return writer.update.apply(this, args);
      }

      return checking.landing([input], 'update', () => writer.update.apply(this, args), (rows) => rows.update(...args));
    };

    const createAll = writer.createAll;
    if (typeof createAll === 'function') {
      guarded.createAll = async function (...args) {
        return checking.landing(args[0], 'createAll', () => createAll.apply(this, args), (rows) => rows.createAll!(...args));
      };
    }

    const updateByKeys = writer.updateByKeys;
    if (typeof updateByKeys === 'function') {
      guarded.updateByKeys = async function (...args) {
        const change = args[1];
        args[1] = async (current) => {
          const patch = await change(current);
          await checking.targetsOf([patch], 'updateByKeys');

          return patch;
        };

        return updateByKeys.apply(this, args);
      };
    }

    const upsert = writer.upsert;
    if (typeof upsert === 'function') {
      guarded.upsert = async function (...args) {
        return checking.landing([args[0]], 'upsert', () => upsert.apply(this, args), (rows) => rows.upsert!(...args));
      };
    }

    const upsertAll = writer.upsertAll;
    if (typeof upsertAll === 'function') {
      guarded.upsertAll = async function (...args) {
        return checking.landing(args[0], 'upsertAll', () => upsertAll.apply(this, args), (rows) => rows.upsertAll!(...args));
      };
    }
  }

  private async landing<R>(
    rows: readonly Record<string, unknown>[],
    operation: string,
    write: () => Promise<R>,
    again: (rows: Writer) => Promise<R>,
  ): Promise<R> {
    const marks = this.marksOf(rows);
    const holding = this.holding;
    if (!holding || marks.length === 0) {
      await this.targetsOf(rows, operation);

      return write();
    }

    return holding(marks, again);
  }

  private marksOf(rows: readonly Record<string, unknown>[]): string[] {
    const marks = this.relations.filter((relation) => relation.marked).flatMap((relation) => rows
      .map((row) => row[relation.field])
      .filter((key) => key !== undefined && key !== null)
      .map((key) => markOf(relation.target, key)));

    return [...new Set(marks)];
  }

  private async targetsOf(rows: readonly Record<string, unknown>[], operation: string): Promise<void> {
    if (this.relations.length === 0) return;

    const refused = await Promise.all(this.relations.map(async (relation) => {
      const keys = [...new Set(
        rows.map((row) => row[relation.field]).filter((key) => key !== undefined && key !== null),
      )];
      if (keys.length === 0) return [];
      const missing = await relation.missing(keys);

      return missing.map((key) => `${relation.field} ${JSON.stringify(key)} — no ${relation.target} holds it`);
    }));

    const errors = refused.flat();
    if (errors.length === 0) return;

    throw new FougereError({
      code: ErrorCode.VALIDATION_FAILED,
      message: `${this.entity}.${operation} names rows that do not exist: ${errors.join(', ')}`,
      details: errors,
    });
  }
}
