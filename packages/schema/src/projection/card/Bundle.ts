import type { Resolver } from '../../schema/axis/Axis.js';
import type { EntityConstructor } from '../../schema/axis/role/Relation.js';
import { lowerFirst } from '../../utils.js';
import type { SchemaView } from '../../schema/SchemaView.js';
import { Card } from './Card.js';
import type { SchemaBundle, SchemaDescriptor } from './Descriptor.js';
import type { Diff, SetDiff, SetDiffOptions } from './diff.js';

type SchemaSet = Record<string, SchemaView> | SchemaView[];

/** A portable schema map and the decisions that only a map can make. */
export class Bundle {
  private constructor(readonly descriptor: SchemaBundle) {}

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

  static fromDescriptor(descriptor: SchemaBundle): Bundle {
    return new Bundle(descriptor);
  }

  toSchemas(): Record<string, SchemaView> {
    const map: Record<string, EntityConstructor> = {};
    const resolve: Resolver = (name) => map[name.toLowerCase()];
    const schemas: Record<string, SchemaView> = {};
    for (const [name, descriptor] of Object.entries(this.descriptor.$defs)) {
      const schema = Card.fromDescriptor(descriptor).toSchema(resolve, name);
      map[name.toLowerCase()] = schema as unknown as EntityConstructor;
      schemas[name] = schema;
    }
    return schemas;
  }

  diff(other: Bundle, options: SetDiffOptions = {}): SetDiff {
    const before = this.descriptor.$defs ?? {};
    const after = other.descriptor.$defs ?? {};
    const entities: Record<string, Diff> = {};
    for (const [name, descriptor] of Object.entries(before)) {
      const target = after[name];
      if (target === undefined) continue;
      const answer = Card.fromDescriptor(descriptor).diff(
        Card.fromDescriptor(target),
        { renamed: options.renamed?.[name] ?? {} },
      );
      if (answer.changes.length > 0 || answer.ambiguous.length > 0) entities[name] = answer;
    }
    return {
      entitiesAdded: Object.keys(after).filter((name) => !(name in before)),
      entitiesRemoved: Object.keys(before).filter((name) => !(name in after)),
      entities,
    };
  }
}
