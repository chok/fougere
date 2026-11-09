import { FieldSet, FieldValueValidator, InputRefusal, Role, type Fields, type Verdict } from '@fougere/schema';
import { COMPARISONS, comparisonOf, unknownIn } from '../storage/Comparison.js';
import { assertListOptions } from '../storage/Storage.js';
import { isChange, type Change } from '../storage/Change.js';
import { ErrorCode } from '../wire/ErrorCode.js';
import { FougereError } from '../wire/FougereError.js';
import type { GuardReport } from './GuardReport.js';

interface Writer {
  create(...args: [Record<string, unknown>, ...unknown[]]): Promise<unknown>;
  createAll?(...args: [readonly Record<string, unknown>[], ...unknown[]]): Promise<unknown>;
  update(...args: [unknown, Record<string, unknown> | Change<Record<string, unknown>>, ...unknown[]]): Promise<unknown>;
  updateByKeys?(...args: [readonly string[], Change<Record<string, unknown>>, ...unknown[]]): Promise<unknown>;
  upsert?(...args: [Record<string, unknown>, ...unknown[]]): Promise<unknown>;
  upsertAll?(...args: [readonly Record<string, unknown>[], ...unknown[]]): Promise<unknown>;
  list?(...args: unknown[]): unknown;
}

/** Judges storage writes and list options without narrowing the storage interface. */
export class StorageGuard {
  private readonly said = new Set<string>();

  constructor(
    private readonly fields: Fields,
    private readonly entity: string,
    private readonly report: GuardReport = {},
  ) {}

  guard<T extends object>(storage: T): T {
    const writer = storage as unknown as Writer;
    if (typeof writer.create !== 'function' || typeof writer.update !== 'function') return storage;

    const guarded = Object.create(storage) as T & Writer;

    this.guardWrites(guarded, writer);
    this.guardList(guarded, writer);

    return guarded;
  }

  private guardWrites(guarded: Writer, writer: Writer): void {
    const validation = this;

    guarded.create = async function (...args) {
      args[0] = validation.validated(args[0], 'create');

      return writer.create.apply(this, args);
    };

    guarded.update = async function (...args) {
      const input = args[1];
      args[1] = isChange(input)
        ? async (current) => validation.validated(await input(current), 'update')
        : validation.validated(input, 'update');

      return writer.update.apply(this, args);
    };

    const createAll = writer.createAll;
    if (typeof createAll === 'function') {
      guarded.createAll = async function (...args) {
        args[0] = args[0].map((row, index) => validation.validated(row, 'createAll', index));

        return createAll.apply(this, args);
      };
    }

    const updateByKeys = writer.updateByKeys;
    if (typeof updateByKeys === 'function') {
      guarded.updateByKeys = async function (...args) {
        const change = args[1];
        args[1] = async (current) => validation.validated(await change(current), 'updateByKeys');

        return updateByKeys.apply(this, args);
      };
    }

    const upsert = writer.upsert;
    if (typeof upsert === 'function') {
      guarded.upsert = async function (...args) {
        args[0] = validation.validated(args[0], 'upsert');

        return upsert.apply(this, args);
      };
    }

    const upsertAll = writer.upsertAll;
    if (typeof upsertAll === 'function') {
      guarded.upsertAll = async function (...args) {
        args[0] = args[0].map((row, index) => validation.validated(row, 'upsertAll', index));

        return upsertAll.apply(this, args);
      };
    }
  }

  private guardList(guarded: Writer, writer: Writer): void {
    const list = writer.list;
    if (typeof list !== 'function') return;

    const validation = this;
    guarded.list = async function (...args: unknown[]) {
      const options = args[0] as { where?: Record<string, unknown> } | undefined;
      assertListOptions(options, validation.entity, Object.keys(validation.fields));
      if (options?.where) args[0] = { ...options, where: validation.criteria(options.where) };

      return list.apply(this, args);
    };
  }

  private rowAt(row: unknown, index: number): string {
    const primary = FieldSet.of(this.fields).primary;
    const key = primary === undefined ? undefined : (row as Record<string, unknown>)[primary];

    return key === undefined ? `row ${index} of this page` : `row ${primary} ${JSON.stringify(key)}`;
  }

  private criteria(where: Record<string, unknown>): Record<string, unknown> {
    const errors: string[] = [];
    const parsed: Record<string, unknown> = {};

    for (const [key, asked] of Object.entries(where)) {
      const read = this.criterion(key, asked);
      if ('message' in read) errors.push(`${key}: ${read.message}`);
      else {
        parsed[key] = read.value;
        this.beyondTheView(key);
      }
    }

    if (errors.length > 0) {
      throw new FougereError({
        code: ErrorCode.BAD_REQUEST,
        message: `Invalid filter on ${this.entity}: ${errors.join(', ')}`,
        details: errors,
      });
    }

    return parsed;
  }

  private criterion(key: string, asked: unknown): Verdict {
    const field = this.fields[key];
    if (!field) return { message: InputRefusal.unknownField };

    const comparison = comparisonOf(field, asked);
    if (comparison) {
      const unknown = unknownIn(comparison);

      return unknown.length
        ? { message: `unknown comparison ${unknown.join(', ')} — one of ${COMPARISONS.join(', ')}` }
        : { value: comparison };
    }

    const values = Array.isArray(asked) ? asked : [asked];
    const each = values.map((value) => this.value(field, value));
    const refused = each.find((one) => 'message' in one);
    if (refused) return refused;

    return { value: Array.isArray(asked) ? each.map(unwrap) : unwrap(each[0]) };
  }

  private beyondTheView(field: string): void {
    const view = this.report.view;
    if (!view || view[field] || this.said.has(field)) return;
    this.said.add(field);
    this.report.outOfView?.(
      `${this.entity}.list() filtered on '${field}', which this facade does not hand back — `
      + 'a filter on a hidden field answers questions about it one call at a time.',
    );
  }

  private written(key: string, item: unknown): Verdict {
    const field = this.fields[key];
    if (!field) return { message: InputRefusal.unknownField };
    if (Role.of(field).isCollection()) return { message: InputRefusal.readOnly };
    if (item === undefined) return { value: item };

    return FieldValueValidator.of(field).parse(item);
  }

  private value(field: Fields[string], asked: unknown): Verdict {
    if (asked === null || asked === undefined) return { value: asked };

    return FieldValueValidator.of(field).parse(asked);
  }

  private validated<T>(value: T, operation: string, index?: number): T {
    if (typeof value !== 'object' || value === null) return value;

    const errors: string[] = [];
    const where = index === undefined ? '' : `${this.rowAt(value, index)} — `;
    const parsed: Record<string, unknown> = {};

    for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
      const read = this.written(key, item);
      if ('message' in read) errors.push(`${where}${key}: ${read.message}`);
      else parsed[key] = read.value;
    }

    if (errors.length > 0) {
      throw new FougereError({
        code: ErrorCode.INTERNAL_ERROR,
        message: `${this.entity}.${operation} was given an invalid row: ${errors.join(', ')}`,
        details: errors,
      });
    }

    return parsed as T;
  }

}

const unwrap = (one: Verdict): unknown =>
  'value' in one ? one.value : undefined;
