import { ErrorCode } from '../../wire/ErrorCode.js';
import { FougereError } from '../../wire/FougereError.js';
import type { RelationCheck } from './RelationCheck.js';
import { release, type Releasing } from './Release.js';

/** The gestures a relation reads before they land. */
interface Writer {
  create(...args: [Record<string, unknown>, ...unknown[]]): Promise<unknown>;
  update(...args: [unknown, Record<string, unknown>, ...unknown[]]): Promise<unknown>;
  upsert?(...args: [Record<string, unknown>, ...unknown[]]): Promise<unknown>;
  upsertAll?(...args: [readonly Record<string, unknown>[], ...unknown[]]): Promise<unknown>;
  delete?(id: string): Promise<boolean>;
}

/**
 * What a `ref()` asks of a storage: its targets read before a write lands, and what names a row
 * released before the row goes. Stands UNDER `StorageGuard`, so it reads the value the guard parsed.
 */
export class RelationGuard {
  constructor(
    private readonly entity: string,
    private readonly relations: readonly RelationCheck[] = [],
    private readonly releasing?: Releasing,
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

  /**
   * What names this row goes first, and this row last: an interruption then leaves fewer
   * children rather than an orphan. A key holds the rest, at the rows, in one statement.
   */
  private guardDelete(guarded: Writer, writer: Writer): void {
    const remove = writer.delete;
    if (typeof remove !== 'function' || !this.releasing) return;

    const checking = this;
    guarded.delete = async function (id) {
      let gone = false;
      await release(checking.entity, id, checking.releasing!, [], async () => {
        gone = await remove.call(this, id);
      });

      return gone;
    };
  }

  /** Every gesture that puts a row down, its targets read first — a whole page in one read per relation. */
  private guardWrites(guarded: Writer, writer: Writer): void {
    const checking = this;

    guarded.create = async function (...args) {
      await checking.targetsOf([args[0]], 'create');

      return writer.create.apply(this, args);
    };

    guarded.update = async function (...args) {
      await checking.targetsOf([args[1]], 'update');

      return writer.update.apply(this, args);
    };

    const upsert = writer.upsert;
    if (typeof upsert === 'function') {
      guarded.upsert = async function (...args) {
        await checking.targetsOf([args[0]], 'upsert');

        return upsert.apply(this, args);
      };
    }

    const upsertAll = writer.upsertAll;
    if (typeof upsertAll === 'function') {
      guarded.upsertAll = async function (...args) {
        await checking.targetsOf(args[0], 'upsertAll');

        return upsertAll.apply(this, args);
      };
    }
  }

  /**
   * The rows a `ref()` points at, read before the write lands.
   *
   * Only the references the boot could not leave to a foreign key reach here — a target in
   * the same source is already refused by the key, at the rows, which this cannot be: the
   * target may be deleted between the read and the write. It catches what a key catches in
   * practice, which is a key that was never right: a row copied from another environment,
   * an author deleted months ago, an id from a test.
   *
   * A patch that does not carry the field says nothing about it, so it is skipped rather
   * than read as `null`.
   */
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
      message: `Refused on the way out of ${this.entity}.${operation} — ${errors.join(', ')}`,
      details: errors,
    });
  }
}
