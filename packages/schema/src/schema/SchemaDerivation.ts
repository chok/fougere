import { type Fields } from './fields/Field.js';
import type { SchemaView } from './SchemaView.js';

/**
 * What a derived schema says about its ORIGIN: the class it was cut from, and what the cut
 * left of each of that class's fields.
 *
 * The origin is the ROOT — `Post.pick(a, b).omit(b)` answers `Post` and never the
 * intermediate — so a chain is flattened rather than journalled, and the two halves cannot
 * disagree: a derivation always carries both, which `source` and `here` as independent
 * properties could not promise.
 */
export class SchemaDerivation {
  private constructor(
    readonly source: SchemaView,
    readonly here: Readonly<Record<string, string | undefined>>,
  ) {}

  /**
   * So the first cut records that every field of the origin still answers to its own name.
   * FR : pour que la première coupe note que chaque champ garde son nom.
   * `SchemaDerivation.first(Post, fields).currentFieldName('title')` → `'title'`
   */
  static first(source: SchemaView, fields: Fields): SchemaDerivation {
    return new SchemaDerivation(
      source,
      Object.fromEntries(Object.keys(fields).map((key) => [key, key])),
    );
  }

  /**
   * So a chain of cuts stays one hop from the root, rather than a journal someone has to walk.
   * FR : pour qu'une chaîne de coupes reste à un saut de la racine.
   * `Post.pick('a', 'b').omit('b')` → the origin is `Post`, never the intermediate
   */
  compose(transform: (key: string) => string | undefined): SchemaDerivation {
    return new SchemaDerivation(
      this.source,
      Object.fromEntries(
        Object.entries(this.here).map(([origin, here]) => [
          origin,
          here === undefined ? undefined : transform(here),
        ]),
      ),
    );
  }

  /**
   * So a card writes `'Post'` without carrying the `Post` class.
   * FR : pour qu'une carte écrive `'Post'` sans embarquer la classe `Post`.
   * `Post.pick('title').derivation.sourceName` → `'Post'`
   */
  get sourceName(): string {
    return this.source.name;
  }

  /**
   * So an answer knows whose rows it borrows, however many cuts away they are.
   * FR : pour qu'une réponse sache à qui elle emprunte ses lignes.
   * `Post.pick('title').omit('title').derivation.anchor` → `Post`
   */
  get anchor(): SchemaView {
    const source = this.source;

    return source.anchored !== undefined || !source.derivation
      ? source
      : source.derivation.anchor;
  }

  /**
   * So a reader asks the root about a field and finds it here, under whatever name it now has.
   * FR : pour qu'on interroge la racine sur un champ et le retrouve ici.
   * `currentFieldName('body')` after `body → text` → `'text'`; after a cut → `undefined`
   */
  currentFieldName(key: string): string | undefined {
    return this.here[key];
  }
}
