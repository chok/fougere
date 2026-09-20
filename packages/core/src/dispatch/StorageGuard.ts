import { FieldSet, FieldValueValidator, InputRefusal, Role, type Fields, type Verdict } from '@fougere/schema';
import { COMPARISONS, comparisonOf, unknownIn } from '../storage/Comparison.js';
import { assertListOptions } from '../storage/Storage.js';
import { ErrorCode } from '../wire/ErrorCode.js';
import { FougereError } from '../wire/FougereError.js';
import type { GuardReport } from './GuardReport.js';
import type { RelationCheck } from './RelationCheck.js';
import { release, type Releasing } from './Release.js';

/** The gestures this guard grafts onto. */
interface Writer {
  create(...args: [Record<string, unknown>, ...unknown[]]): Promise<unknown>;
  update(...args: [unknown, Record<string, unknown>, ...unknown[]]): Promise<unknown>;
  upsert?(...args: [Record<string, unknown>, ...unknown[]]): Promise<unknown>;
  upsertAll?(...args: [readonly Record<string, unknown>[], ...unknown[]]): Promise<unknown>;
  delete?(id: string): Promise<boolean>;
  list?(...args: unknown[]): unknown;
}

/** Judges storage writes and list options without narrowing the storage interface. */
export class StorageGuard {
  /** What has already been said, so a filter in a loop says it once. */
  private readonly said = new Set<string>();

  constructor(
    private readonly fields: Fields,
    private readonly entity: string,
    private readonly report: GuardReport = {},
    private readonly relations: readonly RelationCheck[] = [],
    private readonly releasing?: Releasing,
  ) {}

  guard<T extends object>(storage: T): T {
    const writer = storage as unknown as Writer;
    if (typeof writer.create !== 'function' || typeof writer.update !== 'function') return storage;

    const guarded = Object.create(storage) as T & Writer;

    this.guardDelete(guarded, writer);
    this.guardWrites(guarded, writer);
    this.guardList(guarded, writer);

    return guarded;
  }

  /**
   * What names this row goes first, and this row last: an interruption then leaves fewer
   * children rather than an orphan. A key holds the rest, at the rows, in one statement.
   */
  private guardDelete(guarded: Writer, writer: Writer): void {
    const remove = writer.delete;
    if (typeof remove !== 'function' || !this.releasing) return;

    const validation = this;
    guarded.delete = async function (id) {
      let gone = false;
      await release(validation.entity, id, validation.releasing!, [], async () => {
        gone = await remove.call(this, id);
      });

      return gone;
    };
  }

  /** Every gesture that puts a row down: judged first, and handed on the value it parsed. */
  private guardWrites(guarded: Writer, writer: Writer): void {
    const validation = this;

    guarded.create = async function (...args) {
      args[0] = validation.validated(args[0], 'create');
      await validation.targetsOf([args[0]], 'create');

      return writer.create.apply(this, args);
    };

    guarded.update = async function (...args) {
      args[1] = validation.validated(args[1], 'update');
      await validation.targetsOf([args[1]], 'update');

      return writer.update.apply(this, args);
    };

    const upsert = writer.upsert;
    if (typeof upsert === 'function') {
      guarded.upsert = async function (...args) {
        args[0] = validation.validated(args[0], 'upsert');
        await validation.targetsOf([args[0]], 'upsert');

        return upsert.apply(this, args);
      };
    }

    const upsertAll = writer.upsertAll;
    if (typeof upsertAll === 'function') {
      // Every row before the first write, and the keys of the whole page in one read per
      // relation: a page refused on its fourth row has already written three.
      guarded.upsertAll = async function (...args) {
        args[0] = args[0].map((row, index) => validation.validated(row, 'upsertAll', index));
        await validation.targetsOf(args[0], 'upsertAll');

        return upsertAll.apply(this, args);
      };
    }
  }

  /** A criterion is read where the entity declares it, so a page is asked for what it can answer. */
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

  /**
   * The values this write carries, validated and handed on PARSED — the rule the client facade
   * already holds (`InputValidator`), applied to a write that never passed through it. What a
   * handler is allowed to write is not asked here: only the value is.
   */
  private rowAt(row: unknown, index: number): string {
    const primary = FieldSet.of(this.fields).primary;
    const key = primary === undefined ? undefined : (row as Record<string, unknown>)[primary];

    return key === undefined ? `row ${index} of this page` : `row ${primary} ${JSON.stringify(key)}`;
  }

  /**
   * What a read may ask for. The write facade judges what LANDS in a row; this one judges
   * what a caller says about one — and it was the single entrance to the port with no
   * judge at all, while `params.filter` from a browser reaches it verbatim.
   *
   * A criterion may name a SET, which is the one thing the write facade would refuse: an
   * array is judged member by member, since that is what `IN` binds.
   */
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
        message: `Refused as a filter — ${errors.join(', ')}`,
        entity: this.entity,
        operation: 'list',
        details: errors,
      });
    }

    return parsed;
  }

  /**
   * One criterion, told from a value by the FIELD and never by its own shape.
   *
   * A comparison names its own vocabulary, and a typo in it would otherwise be a criterion that
   * filters nothing — the silent truncation this facade exists to stop.
   */
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

  /**
   * A filter on a field this facade does not hand back.
   *
   * `output(schema)` narrows what is RETURNED and has never narrowed what is asked, so a
   * caller can already sort a hidden column into existence one comparison at a time — and
   * the admin facade copies a browser's filter here verbatim. Said rather than refused: it
   * is legal today, GraphQL batches a relation on a key a view may not carry, and a
   * refusal would break that on the way to fixing this.
   */
  private beyondTheView(field: string): void {
    const view = this.report.view;
    if (!view || view[field] || this.said.has(field)) return;
    this.said.add(field);
    this.report.outOfView?.(
      `${this.entity}.list() filtered on '${field}', which this facade does not hand back — `
      + 'a filter on a hidden field answers questions about it one call at a time.',
    );
  }

  /** One value against one field — validated, then decoded the way the wire hands it. */
  /**
   * One key a handler wrote. A key the entity does not declare has no column to land in and no
   * judge to pass: on the client facade it is a typo, and on this one a mapping that went stale.
   */
  private written(key: string, item: unknown): Verdict {
    const field = this.fields[key];
    if (!field) return { message: InputRefusal.unknownField };
    // Declared, and still nothing to write: the other side of the relation carries the key.
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
        message: `Refused on the way out — ${errors.join(', ')}`,
        entity: this.entity,
        operation,
        details: errors,
      });
    }

    return parsed as T;
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
      message: `Refused on the way out — ${errors.join(', ')}`,
      entity: this.entity,
      operation,
      details: errors,
    });
  }
}

const unwrap = (one: Verdict): unknown =>
  'value' in one ? one.value : undefined;
