import { EXTENSION_AXES, EXTENSION_SLOTS, type Resolver } from '../../schema/axis/Axis.js';
import { dequal } from 'dequal';
import { clean, isObject } from '../../utils.js';
import { Field, type Fields } from '../../schema/fields/Field.js';
import { RowJudge } from '../../judge/RowJudge.js';
import { Schema, type SchemaConstructor } from '../../schema/Schema.js';
import type { Row, SchemaView } from '../../schema/SchemaView.js';
import { refuse } from './admission.js';
import type {
  DerivedFrom,
  FieldDescriptor,
  FieldExtension,
  SchemaDescriptor,
} from './Descriptor.js';
import type { Change, Diff, DiffOptions, RenameCandidate, TypeSet } from './diff.js';

type FieldsOf<T> = { [K in keyof T]-?: Field<T[K]> };

/** One portable schema description and every decision made about that description. */
export class Card<T = Row<Fields>> {
  private constructor(readonly descriptor: SchemaDescriptor) {}

  /**
   * So a class becomes JSON Schema another language can read.
   * FR : pour qu'une classe devienne du JSON Schema lisible par un autre langage.
   * `Card.fromSchema(Post).descriptor` → `{ type: 'object', properties: { … }, title: 'Post' }`
   */
  static fromSchema<TFields extends Fields>(
    schema: SchemaView<TFields>,
    name?: string,
  ): Card<Row<TFields>> {
    const fields = schema.getFields();
    const judge = RowJudge.of(fields);
    const properties: Record<string, FieldDescriptor> = {};
    const required: string[] = [];
    for (const [key, field] of Object.entries(fields)) {
      properties[key] = describeField(field, key);
      if (judge.onAbsent(field) === null) required.push(key);
    }

    const descriptor: SchemaDescriptor = {
      type: 'object',
      properties,
      'x-fougere-version': 1,
      'x-fougere-vendor': 'fougere',
    };
    const title = name ?? schema.derivation?.sourceName ?? schema.name;
    if (title) descriptor.title = title;
    if (required.length) descriptor.required = required;

    const origin = originOf(schema);
    if (origin) descriptor['x-fougere-derived'] = origin;
    return new Card<Row<TFields>>(descriptor);
  }

  /**
   * So a card read from a file or a wire is the same value as one built here.
   * FR : pour qu'une carte lue d'un fichier vaille une carte construite ici.
   * `Card.fromDescriptor(JSON.parse(text))`
   */
  static fromDescriptor<T = Row<Fields>>(descriptor: SchemaDescriptor): Card<T> {
    return new Card<T>(descriptor);
  }

  /**
   * So a card says what its schema was cut from, which its fields cannot.
   * FR : pour qu'une carte dise de quoi son schéma a été coupé, ce que ses champs ne disent pas.
   * `Card.fromSchema(Post.pick('title')).origin` → `{ from: 'Post', … }`
   */
  get origin(): DerivedFrom | undefined {
    return this.descriptor['x-fougere-derived'];
  }

  /**
   * So a card becomes a class again, judging exactly as the original did.
   * FR : pour qu'une carte redevienne une classe, jugeant comme l'originale.
   * `Card.fromDescriptor(d).toSchema().validate({ ghost: 1 })` → `Unknown field`
   */
  toSchema(resolve?: Resolver, name?: string): SchemaConstructor<FieldsOf<T>> {
    const descriptor = this.descriptor;
    const where = name ? `schema '${name}'` : 'this schema';
    if (!isObject(descriptor))
      refuse(`${where} is not an object`, 'A card carries one JSON Schema per door.');
    const version = descriptor['x-fougere-version'];
    if (version !== 1) {
      refuse(
        `${where} states \`x-fougere-version: ${JSON.stringify(version)}\` and this reader speaks 1`,
        'A producer and its readers move together: re-sync the consumer, or serve the version it speaks.',
      );
    }
    if (!isObject(descriptor.properties)) {
      refuse(
        `${where} carries no \`properties\` object`,
        'A schema is its fields; there is nothing to rebuild.',
      );
    }

    const fields: Fields = {};
    for (const [key, property] of Object.entries(descriptor.properties)) {
      fields[key] = reconstructField(property, key, resolve);
    }
    const schema = Schema.of({ fields });
    const title = name ?? descriptor.title;
    if (title)
      Object.defineProperty(schema, 'name', { value: title, configurable: true });
    return schema as unknown as SchemaConstructor<FieldsOf<T>>;
  }

  /**
   * So a consumer sees what moved since it synced — the gap TypeScript cannot see.
   * FR : pour qu'un consommateur voie ce qui a bougé depuis sa synchronisation.
   * `mine.diff(theirs)` → `{ changes: [{ kind: 'required', field: 'slug', … }] }`
   */
  diff(other: Card, options: DiffOptions = {}): Diff {
    const changes: Change[] = [];
    const renamed = options.renamed ?? {};
    const before = this.descriptor.properties ?? {};
    const after = other.descriptor.properties ?? {};
    const requiredBefore = new Set(this.descriptor.required ?? []);
    const requiredAfter = new Set(other.descriptor.required ?? []);

    // Apply a declared rename first so subsequent differences use the new field name.
    const nameAfter = (field: string): string => renamed[field] ?? field;
    const removed: string[] = [];
    for (const [field, descriptor] of Object.entries(before)) {
      const now = nameAfter(field);
      const target = after[now];
      if (target === undefined) {
        removed.push(field);
        continue;
      }

      if (now !== field)
        changes.push({ kind: 'renamed', from: field, to: now, field: target });

      const wasType = typesOf(descriptor);
      const isType = typesOf(target);
      if (!dequal(wasType, isType))
        changes.push({ kind: 'retyped', field: now, from: wasType, to: isType });
      else if (!dequal(boundsOf(descriptor), boundsOf(target))) {
        changes.push({ kind: 'reshaped', field: now, from: descriptor, to: target });
      }

      const wasRequired = requiredBefore.has(field);
      const isRequired = requiredAfter.has(now);
      if (wasRequired !== isRequired) {
        changes.push({ kind: 'required', field: now, from: wasRequired, to: isRequired });
      }
      changes.push(...restated(now, descriptor['x-fougere'], target['x-fougere']));
    }

    const claimed = new Set(Object.values(renamed));
    const added = Object.keys(after).filter(
      (field) => !(field in before) && !claimed.has(field),
    );
    for (const field of removed) {
      changes.push({
        kind: 'removed',
        field,
        from: before[field],
        required: requiredBefore.has(field),
      });
    }
    for (const field of added) {
      changes.push({
        kind: 'added',
        field,
        to: after[field],
        required: requiredAfter.has(field),
      });
    }

    return { changes, ambiguous: candidates(removed, added, before, after) };
  }
}

/**
 * So the three axes write themselves under `x-fougere`, each by its own hand.
 * FR : pour que les trois axes s'écrivent sous `x-fougere`, chacun de sa main.
 * `ref(User)` → `{ role: { relation: { to: 'user', kind: 'one' } } }`
 */
function describeExtension(field: Field, key: string): FieldExtension | undefined {
  const extension: Record<string, unknown> = {};
  for (const axis of EXTENSION_AXES) {
    const declared = (field as unknown as Record<string, unknown>)[axis.slot];
    if (declared === undefined) continue;
    const wire = axis.describe(declared, key);
    if (wire !== undefined) extension[axis.slot] = wire;
  }
  clean(extension);
  return Object.keys(extension).length ? (extension as FieldExtension) : undefined;
}

/**
 * So the shape stays plain JSON Schema, and what is ours sits under one key.
 * FR : pour que la forme reste du JSON Schema, ce qui est à nous tenant sous une clé.
 * `text({ max: 200 })` → `{ type: 'string', maxLength: 200 }`
 */
function describeField(field: Field, key: string): FieldDescriptor {
  // The shape IS JSON Schema, so it lands whole rather than key by key — which is what let
  // it be copied under a computed key into a type that names its own.
  const descriptor: FieldDescriptor = clean({ ...field.shape }) as FieldDescriptor;
  if (field.meta?.description) descriptor.description = field.meta.description;
  const extension = describeExtension(field, key);
  if (extension) descriptor['x-fougere'] = extension;
  return descriptor;
}

/**
 * So a derived card names its root and what became of each field.
 * FR : pour qu'une carte dérivée nomme sa racine et le sort de chaque champ.
 * `Post.pick('title')` → `{ from: 'Post', here: { title: 'title' } }`
 */
function originOf(schema: SchemaView): DerivedFrom | undefined {
  const { derivation } = schema;
  if (!derivation) return undefined;
  const here = Object.fromEntries(
    Object.entries(derivation.here).map(([key, value]) => [key, value ?? null]),
  );
  return { from: derivation.sourceName, here };
}

/**
 * So a shape read back keeps its bounds, and an unknown type is refused.
 * FR : pour qu'une forme relue garde ses bornes, un type inconnu étant refusé.
 * `{ type: 'string', maxLength: 200 }` → the same shape a `text({ max: 200 })` states
 */
function reconstructShape(property: FieldDescriptor): Field['shape'] | undefined {
  const types = Array.isArray(property.type)
    ? property.type
    : property.type
      ? [property.type]
      : [];
  const base = types.find((type) => type !== 'null');
  if (base === undefined) return undefined;
  const type = property.type as Field['shape']['type'];
  if (base === 'array') {
    const items = property.items ? reconstructShape(property.items) : undefined;
    return clean({
      type,
      items,
      minItems: property.minItems,
      maxItems: property.maxItems,
    }) as Field['shape'];
  }
  switch (base) {
    case 'string':
      return clean({
        type,
        minLength: property.minLength,
        maxLength: property.maxLength,
        pattern: property.pattern,
        enum: property.enum,
        format: property.format,
      }) as Field['shape'];
    case 'number':
    case 'integer':
      return clean({
        type,
        minimum: property.minimum,
        maximum: property.maximum,
      }) as Field['shape'];
    case 'boolean':
      return { type } as Field['shape'];
    default:
      return clean({
        type,
        properties: property.properties,
        required: property.required,
      }) as Field['shape'];
  }
}

/**
 * So a field read back carries its axes, rebuilt by the axes themselves.
 * FR : pour qu'un champ relu porte ses axes, reconstruits par les axes eux-mêmes.
 * `{ 'x-fougere': { lifecycle: { create: 'now' } } }` → a field stamped at create
 */
function reconstructField(
  property: FieldDescriptor,
  key: string,
  resolve?: Resolver,
): Field {
  const shape = reconstructShape(property);
  if (!shape) {
    throw new Error(
      `Field '${key}': the card carries no \`type\` for it, so there is no shape to rebuild. ` +
        'A field always states one.',
    );
  }
  const extension = property['x-fougere'];
  const axes: Record<string, unknown> = {};
  for (const axis of EXTENSION_AXES) {
    const wire = (extension as Record<string, unknown> | undefined)?.[axis.slot];
    if (wire !== undefined) axes[axis.slot] = axis.reconstruct(wire, resolve);
  }
  return new Field({
    shape,
    ...axes,
    meta:
      property.description !== undefined
        ? { description: property.description }
        : undefined,
  } as never);
}

/**
 * So an axis that changed is one named difference, not a whole field marked dirty.
 * FR : pour qu'un axe modifié soit une différence nommée, pas un champ entier marqué.
 * `{ kind: 'restated', field: 'body', axis: 'boundary', … }`
 */
function restated(
  field: string,
  before: FieldExtension | undefined,
  after: FieldExtension | undefined,
): Change[] {
  return EXTENSION_SLOTS.filter((axis) => !dequal(before?.[axis], after?.[axis])).map(
    (axis) =>
      ({
        kind: 'restated',
        field,
        axis,
        from: before?.[axis],
        to: after?.[axis],
      }) as Change,
  );
}

/**
 * So two shapes are compared without what is not shape getting in the way.
 * FR : pour que deux formes se comparent sans que le reste s'en mêle.
 * `{ type: 'string', description: 'x' }` → `{ type: 'string' }`
 */
function shapeOf(descriptor: FieldDescriptor): Record<string, unknown> {
  const { 'x-fougere': _extension, ...shape } = descriptor;
  return shape as Record<string, unknown>;
}

/**
 * So `['string','null']` and `['null','string']` are the same type, not a change.
 * FR : pour que `['string','null']` et `['null','string']` soient un même type.
 * `typesOf({ type: ['null', 'string'] })` → `['null', 'string']`
 */
function typesOf(descriptor: FieldDescriptor): TypeSet {
  const type = descriptor.type;
  if (type === undefined) return [];
  return (Array.isArray(type) ? [...type] : [type]).sort();
}

/**
 * So a bound that moved is a `reshaped`, told apart from a type that changed.
 * FR : pour qu'une borne déplacée soit un `reshaped`, distinct d'un type changé.
 * `maxLength: 200` → `maxLength: 100` → one `reshaped`, never a `retyped`
 */
function boundsOf(descriptor: FieldDescriptor): Record<string, unknown> {
  const { type: _type, ...rest } = shapeOf(descriptor);
  return rest;
}

/**
 * So a removal plus an addition of the same shape is a question, never a guess.
 * FR : pour qu'une suppression plus un ajout de même forme soit une question, pas un pari.
 * `body` gone, `content` appeared → `ambiguous: [{ removed: 'body', added: 'content' }]`
 */
function candidates(
  removed: string[],
  added: string[],
  before: Record<string, FieldDescriptor>,
  after: Record<string, FieldDescriptor>,
): RenameCandidate[] {
  const found: RenameCandidate[] = [];
  for (const gone of removed) {
    for (const appeared of added) {
      if (dequal(shapeOf(before[gone]), shapeOf(after[appeared])))
        found.push({ removed: gone, added: appeared });
    }
  }
  const was = Object.keys(before);
  const now = Object.keys(after);
  const apart = ({ removed: gone, added: appeared }: RenameCandidate): number =>
    Math.abs(now.indexOf(appeared) - was.indexOf(gone));
  return found.sort((a, b) => apart(a) - apart(b));
}
