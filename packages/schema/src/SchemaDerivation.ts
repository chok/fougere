import { type Fields } from './field/Fields.js';
import type { SchemaView } from './SchemaView.js';

/**
 * Where a derived schema comes from.
 * Ex: `Post.pick('a', 'b').omit('b')` comes from `Post`.
 *
 * Documented: [views](https://fougere.dev/docs/concepts/entity).
 */
export class SchemaDerivation {
  private constructor(
    readonly source: SchemaView,
    readonly nameOf: Readonly<Record<string, string | undefined>>,
  ) {}

  static first(source: SchemaView, fields: Fields): SchemaDerivation {
    return new SchemaDerivation(
      source,
      Object.fromEntries(Object.keys(fields).map((key) => [key, key])),
    );
  }

  rename(transform: (key: string) => string | undefined): SchemaDerivation {
    return new SchemaDerivation(
      this.source,
      Object.fromEntries(
        Object.entries(this.nameOf).map(([origin, here]) => [
          origin,
          here === undefined ? undefined : transform(here),
        ]),
      ),
    );
  }

  get sourceName(): string {
    return this.source.name;
  }

  /** Whose rows this one borrows, however many cuts away: `Post.pick('t').omit('t')` → `Post`. */
  get anchor(): SchemaView {
    const source = this.source;

    return source.anchored !== undefined || !source.derivation
      ? source
      : source.derivation.anchor;
  }
}
