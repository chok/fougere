import { Lifecycle, type EntityConstructor, type Fields } from '@fougere/schema';
import type { Storage } from '../storage.js';

/** A paginated local copy of a source that cannot be queried directly. */
/** What one refresh did — enough to log it, and to decide whether to run again. */
export interface Refreshed {
  /** Instances written, counting a replaced one once. */
  written: number;
  /** The age the pull was asked to start from — absent on the first ever run. */
  since?: Date;
  /** How long the whole pass took, pull included. */
  ms: number;
}

export interface MirrorOf<T> {
  /** The copy's own storage — where a page lands, and where its age is read. */
  storage: Storage<T>;
  /** Pages of rows to write. The one thing a mirror's author supplies. */
  pull(since?: Date): AsyncIterable<Partial<T>[]>;
  /** Run one pass: read the high-water mark, pull from there, write each page. */
  refresh(): Promise<Refreshed>;
  /** When the freshest row here was written — `undefined` while the copy is empty. */
  freshness(): Promise<Date | undefined>;
}

export interface MirrorConstructor<T> {
  new (storage: Storage<T>): MirrorOf<T>;
  readonly __entity: unknown;
}

export function Mirror<E extends EntityConstructor>(shape: E): MirrorConstructor<InstanceType<E>> {
  type T = InstanceType<E>;

  // Refuse an undated copy before it can be used as if it held live rows.
  const declared = ageFieldOf(shape);
  if (declared === undefined) {
    throw new Error(
      `Mirror(${(shape as { name?: string }).name ?? '?'}): the shape carries no \`updated()\` field — ` +
      `a copy has to be able to say when it was pulled, and \`refresh\` reads its high-water mark from it.`,
    );
  }
  const age: string = declared;

  abstract class MirrorBase implements MirrorOf<T> {
    static readonly __entity = shape;

    constructor(public storage: Storage<T>) {}

    abstract pull(since?: Date): AsyncIterable<Partial<T>[]>;

    /** The freshest persisted stamp; no process-local freshness state is kept. */
    async freshness(): Promise<Date | undefined> {
      const [newest] = await this.storage.list({ orderBy: age, order: 'desc', limit: 1 });
      const value = (newest as Record<string, unknown> | undefined)?.[age];
      return value instanceof Date ? value : undefined;
    }

    async refresh(): Promise<Refreshed> {
      const started = Date.now();
      const since = await this.freshness();
      let written = 0;
      // Preserve the source's page boundaries: one page becomes one upsert.
      for await (const page of this.pull(since)) {
        if (page.length === 0) continue;
        written += await this.storage.upsertAll(page);
      }
      return { written, since, ms: Date.now() - started };
    }
  }

  return MirrorBase as unknown as MirrorConstructor<T>;
}

/** The field whose lifecycle stamps every update. */
export function ageFieldOf(shape: unknown): string | undefined {
  const fields = (shape as { getFields?: () => Fields }).getFields?.();
  if (!fields) return undefined;
  for (const [name, field] of Object.entries(fields)) {
    if (Lifecycle.of(field).stampedOnUpdate) return name;
  }
  return undefined;
}
