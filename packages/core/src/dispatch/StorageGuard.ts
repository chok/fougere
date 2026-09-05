import { Boundary, FieldSet, FieldValueValidator, InputRefusal, type Fields } from '@fougere/schema';
import { assertListOptions } from '../storage.js';
import { ErrorCode, FougereError } from '../wire/errors.js';

/** The gestures this guard grafts onto. */
interface Writer {
  create(...args: [Record<string, unknown>, ...unknown[]]): Promise<unknown>;
  update(...args: [unknown, Record<string, unknown>, ...unknown[]]): Promise<unknown>;
  upsert?(...args: [Record<string, unknown>, ...unknown[]]): Promise<unknown>;
  upsertAll?(...args: [readonly Record<string, unknown>[], ...unknown[]]): Promise<unknown>;
  list?(...args: unknown[]): unknown;
}

/** Judges storage writes and list options without narrowing the storage interface. */
export class StorageGuard {
  constructor(
    private readonly fields: Fields,
    private readonly entity: string,
  ) {}

  guard<T extends object>(storage: T): T {
    const writer = storage as unknown as Writer;
    if (typeof writer.create !== 'function' || typeof writer.update !== 'function') return storage;

    const validation = this;
    const guarded = Object.create(storage) as T & Writer;

    guarded.create = async function (...args) {
      args[0] = validation.validated(args[0], 'create');
      return writer.create.apply(this, args);
    };

    guarded.update = async function (...args) {
      args[1] = validation.validated(args[1], 'update');
      return writer.update.apply(this, args);
    };

    const upsert = writer.upsert;
    if (typeof upsert === 'function') {
      guarded.upsert = async function (...args) {
        args[0] = validation.validated(args[0], 'upsert');
        return upsert.apply(this, args);
      };
    }

    const upsertAll = writer.upsertAll;
    if (typeof upsertAll === 'function') {
      // Every row before the first write: a page refused halfway leaves rows behind that
      // the caller asked for as one, and the refusal is readable from the input alone.
      guarded.upsertAll = async function (...args) {
        args[0] = args[0].map((row, index) => validation.validated(row, 'upsertAll', index));
        return upsertAll.apply(this, args);
      };
    }

    const list = writer.list;
    if (typeof list === 'function') {
      guarded.list = async function (...args: unknown[]) {
        assertListOptions(args[0] as object | undefined, validation.entity);
        return list.apply(this, args);
      };
    }

    return guarded;
  }

  /**
   * The values this write carries, validated and handed on PARSED — the rule the client door
   * already holds (`InputValidator`), applied to a write that never passed through it. What a
   * handler is allowed to write is not asked here: only the value is.
   */
  private rowAt(row: unknown, index: number): string {
    const primary = FieldSet.of(this.fields).primary;
    const key = primary === undefined ? undefined : (row as Record<string, unknown>)[primary];
    return key === undefined ? `row ${index} of this page` : `row ${primary} ${JSON.stringify(key)}`;
  }

  private validated<T>(value: T, operation: string, index?: number): T {
    if (typeof value !== 'object' || value === null) return value;

    const errors: string[] = [];
    const where = index === undefined ? '' : `${this.rowAt(value, index)} — `;
    const parsed: Record<string, unknown> = {};

    for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
      const field = this.fields[key];
      // A key the entity does not declare has no column to land in and no judge to pass:
      // on the client door it is a typo, and on this one it is a mapping that went stale.
      if (!field) {
        errors.push(`${where}${key}: ${InputRefusal.unknownField}`);
        continue;
      }
      if (item === undefined) {
        parsed[key] = item;
        continue;
      }
      const checked = FieldValueValidator.of(field).validate(item);
      if ('error' in checked) {
        errors.push(`${where}${key}: ${checked.error}`);
        continue;
      }
      if (checked.value === null) {
        parsed[key] = null;
        continue;
      }
      const decoded = Boundary.of(field).decode(checked.value);
      if ('error' in decoded) errors.push(`${where}${key}: ${decoded.error}`);
      else parsed[key] = decoded.value;
    }

    if (errors.length > 0) {
      throw new FougereError({
        code: ErrorCode.INTERNAL_ERROR,
        message: `Refused on the way out — ${errors.join(', ')}`,
        entity: this.entity,
        operation,
        details: errors,
      });
    }

    return parsed as T;
  }
}
