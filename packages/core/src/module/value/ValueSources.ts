import type { SchemaView } from '@fougere/schema';

/**
 * The entities `sources:` holds as one value each.
 *
 * Documented: [values](https://fougere.dev/docs/data/values).
 */
export interface ValueSources {
  /** The source holding it as a value, or nothing when it is rows. */
  sourceOf(entityName: string): string | undefined;
  /** The value as its source holds it — absent when the source holds none. */
  read(entityName: string, entity: SchemaView): Promise<Record<string, unknown> | undefined>;
  /** Where a reader goes to change it: a variable, a file, a row. */
  where(entityName: string, entity: SchemaView, field?: string): string;
}
