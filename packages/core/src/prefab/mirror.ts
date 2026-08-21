import { Lifecycle, Role, type EntityConstructor, type Fields, type ValidationResult } from '@fougere/schema';
import type { EntityOrm } from '../orm.js';

/**
 * Mirror(Shape) — a local copy of rows that live somewhere this app cannot query.
 *
 * The subclass supplies ONE thing, the pull; everything around it is the same for
 * every mirror and belongs here:
 *
 * ```ts
 * // mirrors/PartnerCatalog.ts
 * export default class PartnerCatalog extends Mirror(BookCard) {
 *   constructor(orm: EntityOrm<BookCard>, private catalog: Facade<CatalogHandler>) {
 *     super(orm);
 *   }
 *
 *   async *pull(since?: Date) {
 *     for (let page = 0; page !== null;) {
 *       const body = await fetch(`${api}?page=${page}&since=${since?.toISOString() ?? ''}`);
 *       const { items, next } = await body.json();
 *       yield items.map(toCard);
 *       page = next;
 *     }
 *   }
 * }
 * ```
 *
 * **A generator, not a return.** A source that has to be copied is a source that
 * paginates, and a method returning the whole set holds it in memory before the first
 * row is written. Yielding a page is the shape the write already has (`upsertAll`), so
 * the two meet without an array in between.
 *
 * **It exists for what cannot be attached.** A real database is queried where it is —
 * measured: attaching Postgres pushes the filter down over 100 000 rows, and copying
 * it would be more work, more storage and older data for strictly less. This is the
 * answer for a source with no algebra: an HTTP API, a frond behind a wire.
 *
 * **What it copies is a copy, whatever the shape is called.** A derivation is the
 * ordinary spelling and the DDL refuses an undated one; an ENTITY may be a mirror too
 * (a search index states itself flat and copies rather than referencing) and no DDL
 * rule reaches it — so the age is required HERE, at construction, and both spellings
 * are covered. Without it `refresh` has no high-water mark and every pass re-reads the
 * whole source.
 *
 * **It judges what it is handed.** A handler writes through the ORM freely because it
 * is the author; here the author is a third party, so a page is CLIENT input and meets
 * the same judge as any other — a partner renaming `label` writes nulls in silence
 * otherwise. Strictly, and never tolerantly: a tolerant mode was built for facts and
 * reverted on 2026-08-09, for the reason that applies here word for word — a reader
 * silently ignoring a field it should have handled is worse than a loud refusal.
 *
 * A refused page stops the pass. What earlier pages wrote stays, because an upsert is
 * idempotent and the next run resumes from the high-water mark — so a bad row costs
 * the tail of one run, not the run.
 *
 * **What it does not do**: schedule itself. Nothing here decides when a refresh runs —
 * a boot hook, a cron, an op behind a door are all legitimate and none of them is this
 * class's business. It refreshes when someone says so, and reports what it wrote.
 */
/** What one refresh did — enough to log it, and to decide whether to run again. */
export interface Refreshed {
  /** Rows written, counting a replaced row once. */
  written: number;
  /** The age the pull was asked to start from — absent on the first ever run. */
  since?: Date;
  /** How long the whole pass took, pull included. */
  ms: number;
}

export interface MirrorOf<T> {
  /** The copy's own storage — where a page lands, and where its age is read. */
  orm: EntityOrm<T>;
  /** Pages of rows to write. The one thing a mirror's author supplies. */
  pull(since?: Date): AsyncIterable<Partial<T>[]>;
  /** Run one pass: read the high-water mark, pull from there, write each page. */
  refresh(): Promise<Refreshed>;
  /** When the freshest row here was written — `undefined` while the copy is empty. */
  freshness(): Promise<Date | undefined>;
}

export interface MirrorConstructor<T> {
  new (orm: EntityOrm<T>): MirrorOf<T>;
  readonly __entity: unknown;
}

export function Mirror<E extends EntityConstructor>(shape: E): MirrorConstructor<InstanceType<E>> {
  type T = InstanceType<E>;

  // Refused here rather than at the first refresh: a copy that cannot say when it was
  // pulled reads exactly like live rows, and the day that matters is the day a report
  // is already wrong. The DDL states the same rule for a stored derivation; an entity
  // used as a mirror reaches no such rule, so this is where both are covered.
  const declared = ageFieldOf(shape);
  if (declared === undefined) {
    throw new Error(
      `Mirror(${(shape as { name?: string }).name ?? '?'}): the shape carries no \`updated()\` field — ` +
      `a copy has to be able to say when it was pulled, and \`refresh\` reads its high-water mark from it.`,
    );
  }
  // Held as its own binding: the narrowing above does not survive into the class body.
  const age: string = declared;

  abstract class MirrorBase implements MirrorOf<T> {
    static readonly __entity = shape;

    constructor(public orm: EntityOrm<T>) {}

    abstract pull(since?: Date): AsyncIterable<Partial<T>[]>;

    /**
     * The freshest row's stamp — read off the field the shape had to declare.
     *
     * Asked of the storage rather than remembered here: a mirror is refreshed by
     * whoever holds it, possibly in another process, and a number kept in memory would
     * be one process's opinion of what the table holds.
     */
    async freshness(): Promise<Date | undefined> {
      const [newest] = await this.orm.list({ orderBy: age, order: 'desc', limit: 1 });
      const value = (newest as Record<string, unknown> | undefined)?.[age];
      return value instanceof Date ? value : undefined;
    }

    async refresh(): Promise<Refreshed> {
      const started = Date.now();
      const since = await this.freshness();
      let written = 0;
      // One statement per page, and the page is the author's — a source that paginates
      // decides its own size, and re-cutting it here would only add a copy.
      for await (const page of this.pull(since)) {
        if (page.length === 0) continue;
        written += await this.orm.upsertAll(judgePage(shape, page) as Partial<T>[]);
      }
      return { written, since, ms: Date.now() - started };
    }
  }

  return MirrorBase as unknown as MirrorConstructor<T>;
}

/**
 * The key a refused row is named by — read off the shape, never spelled `id`.
 *
 * A mirror copies whatever the source keys its rows on: an ISBN, a partner reference.
 * Naming the field too means the sentence points at something the operator can look up
 * on the OTHER side, which is the whole use of it.
 */
function primaryFieldOf(shape: unknown): string | undefined {
  const fields = (shape as { getFields?: () => Fields }).getFields?.();
  if (!fields) return undefined;
  for (const [name, field] of Object.entries(fields)) {
    if (Role.of(field).isPrimary) return name;
  }
  return undefined;
}

/**
 * The field a copy states its age with — the one the storage stamps on every write.
 *
 * Read off the shape rather than named in a config: `update: 'now'` already means
 * "when this row last changed here", which for a copy is when it was last pulled.
 */
export function ageFieldOf(shape: unknown): string | undefined {
  const fields = (shape as { getFields?: () => Fields }).getFields?.();
  if (!fields) return undefined;
  for (const [name, field] of Object.entries(fields)) {
    if (Lifecycle.of(field).stampedOnUpdate) return name;
  }
  return undefined;
}

/**
 * Every row of a page, judged and PARSED — the value written is the one the judge
 * returned, so a declared boundary earns its call on the way in exactly as it does at
 * a façade.
 *
 * Names the row by the key its SHAPE declares: an import of thousands says which one,
 * in the vocabulary of the source it came from.
 */
function judgePage<T>(shape: unknown, page: Partial<T>[]): Record<string, unknown>[] {
  const judge = (shape as { validate?: (input: unknown) => ValidationResult<unknown> }).validate;
  if (typeof judge !== 'function') return page as Record<string, unknown>[];

  const name = (shape as { name?: string }).name ?? 'mirror';
  const primary = primaryFieldOf(shape);
  return page.map((row, index) => {
    const verdict = judge.call(shape, row);
    if (verdict.success) return verdict.data as Record<string, unknown>;
    const key = primary === undefined ? undefined : (row as Record<string, unknown>)[primary];
    const where = key !== undefined ? `row ${primary} ${JSON.stringify(key)}` : `row ${index} of this page`;
    const why = verdict.errors.map((e) => `${e.path}: ${e.message}`).join(', ');
    throw new Error(`${name} mirror refused ${where} — ${why}`);
  });
}
