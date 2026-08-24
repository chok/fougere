import { type Fields } from './Field.js';

export type SchemaSourceClass = abstract new (...args: never[]) => unknown;

/**
 * What a derived schema says about its ORIGIN: the class it was cut from, and what the cut
 * left of each of that class's fields.
 *
 * The origin is the ROOT — `Post.pick(a, b).omit(b)` answers `Post` and never the
 * intermediate — so a chain is flattened rather than journalled, and the two halves cannot
 * disagree: a derivation always carries both, which `source` and `survived` as independent
 * properties could not promise.
 */
export class SchemaDerivation {
  private constructor(
    readonly source: SchemaSourceClass,
    readonly survived: Readonly<Record<string, string | undefined>>,
  ) {}

  /** The first cut: every field of the origin still answers to its own name. */
  static first(source: SchemaSourceClass, fields: Fields): SchemaDerivation {
    return new SchemaDerivation(source, Object.fromEntries(Object.keys(fields).map((key) => [key, key])));
  }

  /** The same origin, seen through one more cut. */
  compose(survives: (key: string) => string | undefined): SchemaDerivation {
    return new SchemaDerivation(
      this.source,
      Object.fromEntries(
        Object.entries(this.survived).map(([origin, here]) => [origin, here === undefined ? undefined : survives(here)]),
      ),
    );
  }

  /** What the origin's `key` is called here, or `undefined` when a cut dropped it. */
  nameOf(key: string): string | undefined {
    return this.survived[key];
  }

  get sourceName(): string {
    return this.source.name;
  }
}
