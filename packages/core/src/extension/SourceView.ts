import type { SchemaView } from '@fougere/schema';

/** The app as ONE source sees it: the entities it holds, by the name the scan wrote down. */
export interface SourceView {
  entities: ReadonlyMap<string, SchemaView>;
  /** The names another source holds — a reference to one gets a column and no key. Absent: all here. */
  inOtherSources?: readonly string[];
}
