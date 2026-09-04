import type { Resolver } from '../../axis/Axis.js';
import type { EntityConstructor } from '../../axis/role/Relation.js';
import { lowerFirst } from '../../lib/utils.js';
import type { SchemaView } from '../../SchemaView.js';
import { Card } from './Card.js';
import type { SchemaBundle, SchemaDescriptor } from './Descriptor.js';
import type { Diff, SetDiff, SetDiffOptions } from './diff.js';

type SchemaSet = Record<string, SchemaView> | SchemaView[];

/** A portable schema map and the decisions that only a map can make. */
export class Bundle {
  private constructor(readonly descriptor: SchemaBundle) {}

  /**
   * So two schemas claiming one key are refused, naming both, instead of one silently winning.
   * FR : pour que deux schémas sur une même clé soient refusés en les nommant.
   * `Bundle.fromSchemas([Post, PostCard])` when both register as `post` → throws, naming both
   */
  static fromSchemas(schemas: SchemaSet): Bundle {
    const definitions: Record<string, SchemaDescriptor> = {};
    const claimedBy = new Map<string, string>();
    const entries = Array.isArray(schemas)
      ? schemas.map((schema) => {
          const card = Card.fromSchema(schema);
          return { name: card.descriptor.title ?? '', schema };
        })
      : Object.entries(schemas).map(([name, schema]) => ({ name, schema }));

    for (const entry of entries) {
      const key = lowerFirst(entry.name);
      const previous = claimedBy.get(key);
      if (previous !== undefined) {
        throw new Error(
          `Schemas '${previous}' and '${entry.name}' both claim bundle key '${key}'. `
          + 'Each schema in a bundle must have a distinct registration key.',
        );
      }
      claimedBy.set(key, entry.name);
      definitions[key] = Card.fromSchema(entry.schema, key).descriptor;
    }

    return new Bundle({
      $defs: definitions,
      'x-fougere-version': 1,
      'x-fougere-vendor': 'fougere',
    });
  }

  /**
   * So a bundle read from a file or a wire is the same value as one built from classes.
   * FR : pour qu'un lot lu d'un fichier vaille un lot bâti depuis des classes.
   * `Bundle.fromDescriptor(JSON.parse(text))`
   */
  static fromDescriptor(descriptor: SchemaBundle): Bundle {
    return new Bundle(descriptor);
  }

  /**
   * So a `ref()` between two entities of the bundle resolves, which one card alone cannot do.
   * FR : pour qu'un `ref()` entre deux entités du lot se résolve.
   * `bundle.toSchemas().post` → `author` resolves to the `user` schema of the same bundle
   */
  toSchemas(): Record<string, SchemaView> {
    const byName: Record<string, EntityConstructor> = {};
    const resolve: Resolver = (name) => byName[name.toLowerCase()];
    const schemas: Record<string, SchemaView> = {};
    for (const [name, descriptor] of Object.entries(this.descriptor.$defs)) {
      const schema = Card.fromDescriptor(descriptor).toSchema(resolve, name);
      byName[name.toLowerCase()] = schema as unknown as EntityConstructor;
      schemas[name] = schema;
    }
    return schemas;
  }

  /**
   * So a consumer sees what moved since it synced, which TypeScript cannot tell it.
   * FR : pour qu'un consommateur voie ce qui a bougé depuis sa synchronisation.
   * `mine.diff(theirs)` → `{ entitiesAdded: ['comment'], entities: { post: { changes: […] } } }`
   */
  diff(other: Bundle, options: SetDiffOptions = {}): SetDiff {
    const before = this.descriptor.$defs ?? {};
    const after = other.descriptor.$defs ?? {};
    const entities: Record<string, Diff> = {};
    for (const [name, descriptor] of Object.entries(before)) {
      const target = after[name];
      if (target === undefined) continue;
      const diff = Card.fromDescriptor(descriptor).diff(
        Card.fromDescriptor(target),
        { renamed: options.renamed?.[name] ?? {} },
      );
      if (diff.changes.length > 0 || diff.ambiguous.length > 0) entities[name] = diff;
    }
    return {
      entitiesAdded: Object.keys(after).filter((name) => !(name in before)),
      entitiesRemoved: Object.keys(before).filter((name) => !(name in after)),
      entities,
    };
  }
}
