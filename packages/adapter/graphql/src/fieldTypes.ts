import { upperFirst } from '@fougere/schema';
import type SchemaBuilder from '@pothos/core';
import { Shapes, type Shape } from '@fougere/schema';
import type { Field } from '@fougere/schema';
import { Boundary, Lifecycle } from '@fougere/schema';

export function fieldToGraphQL(
  t: any,
  field: Field,
  fieldName: string,
  enumFor?: (values: string[]) => any | undefined,
  nested?: (shape: Shape, suffix: string) => any,
): any {
  const { base: shape, nullable } = Shapes.of(field.shape);

  const values = enumFor && enumValuesOf(shape);
  if (values) {
    const ref = enumFor(values);
    if (ref) {
      const resolve = (parent: any) => parent[fieldName] ?? null;

      return nullable ? t.field({ type: ref, nullable: true, resolve }) : t.field({ type: ref, resolve });
    }
  }

  switch (shape?.type) {
    case 'integer':
      return nullable ? t.int({ nullable: true, resolve: (parent: any) => parent[fieldName] ?? null })
                      : t.exposeInt(fieldName);

    case 'number':
      return nullable ? t.float({ nullable: true, resolve: (parent: any) => parent[fieldName] ?? null })
                      : t.exposeFloat(fieldName);

    case 'boolean':
      return nullable ? t.boolean({ nullable: true, resolve: (parent: any) => parent[fieldName] ?? null })
                      : t.exposeBoolean(fieldName);

    case 'object':
      if (nested && declaresProperties(shape)) {
        return t.field({ type: nested(shape, ''), nullable, resolve: (parent: any) => parent[fieldName] ?? null });
      }

      return t.string({
        nullable,
        resolve: (parent: any) => {
          const val = parent[fieldName];

          return val != null ? JSON.stringify(val) : null;
        },
      });

    case 'array': {
      const items = Shapes.of(shape.items).base;
      const resolve = (parent: any) => parent[fieldName] ?? (nullable ? null : []);
      switch (items?.type) {
        case 'integer': return t.intList({ nullable, resolve });
        case 'number': return t.floatList({ nullable, resolve });
        case 'boolean': return t.booleanList({ nullable, resolve });
        case 'object':
          if (nested && declaresProperties(items)) return t.field({ type: [nested(items, 'Item')], nullable, resolve });

          return t.stringList({
            nullable,
            resolve: (parent: any) => {
              const val = parent[fieldName];

              return val != null ? val.map((v: unknown) => JSON.stringify(v)) : (nullable ? null : []);
            },
          });
        default: return t.stringList({ nullable, resolve });
      }
    }

    case 'string':
      if (shape.format === 'date-time') {
        return t.string({
          nullable,
          resolve: (parent: any) => {
            const val = parent[fieldName];

            return val != null ? Boundary.of(field).encode(val) : null;
          },
        });
      }

      return nullable ? t.string({ nullable: true, resolve: (parent: any) => parent[fieldName] ?? null })
                      : t.exposeString(fieldName);

    default:
      return nullable ? t.string({ nullable: true, resolve: (parent: any) => parent[fieldName] ?? null })
                      : t.exposeString(fieldName);
  }
}

export function nestedInputType(
  builder: InstanceType<typeof SchemaBuilder>,
  shape: Shape,
  name: string,
): any {
  let perBuilder = nestedInputs.get(builder as object);
  if (!perBuilder) nestedInputs.set(builder as object, (perBuilder = new Map()));
  const known = perBuilder.get(name);
  if (known) return known;

  const properties = propertiesOf(shape);
  const required = new Set<string>('required' in shape ? shape.required ?? [] : []);
  const type = (builder as any).inputType(name, {
    fields: (t: any) => {
      const out: Record<string, any> = {};
      for (const [key, prop] of Object.entries(properties)) {
        const isRequired = required.has(key);
        const base = Shapes.of(prop).base;
        const inner = (held: Shape, suffix: string) => nestedInputType(builder, held, `${name}${upperFirst(key)}${suffix}`);
        const items = base?.type === 'array' ? Shapes.of(base.items).base : undefined;
        if (base && declaresProperties(base)) out[key] = t.field({ type: inner(base, ''), required: isRequired });
        else if (items && declaresProperties(items)) out[key] = t.field({ type: [inner(items, 'Item')], required: isRequired });
        else if (base?.type === 'integer') out[key] = t.int({ required: isRequired });
        else if (base?.type === 'number') out[key] = t.float({ required: isRequired });
        else if (base?.type === 'boolean') out[key] = t.boolean({ required: isRequired });
        else out[key] = t.string({ required: isRequired });
      }

      return out;
    },
  });
  perBuilder.set(name, type);

  return type;
}

export function nestedObjectType(
  builder: InstanceType<typeof SchemaBuilder>,
  shape: Shape,
  name: string,
): any {
  let perBuilder = nestedObjects.get(builder as object);
  if (!perBuilder) nestedObjects.set(builder as object, (perBuilder = new Map()));
  const known = perBuilder.get(name);
  if (known) return known;

  const properties = Object.entries(propertiesOf(shape)).filter(([, prop]) => !(prop as { writeOnly?: boolean }).writeOnly);
  const required = new Set<string>('required' in shape ? shape.required ?? [] : []);
  const type = (builder as any).objectRef(name);
  perBuilder.set(name, type);
  type.implement({
    fields: (t: any) => {
      const out: Record<string, any> = {};
      for (const [key, prop] of properties) {
        const { base, nullable: stated } = Shapes.of(prop);
        const nullable = stated || !required.has(key);
        const resolve = (parent: any) => parent[key] ?? null;
        const inner = (held: Shape, suffix: string) => nestedObjectType(builder, held, `${name}${upperFirst(key)}${suffix}`);
        const items = base?.type === 'array' ? Shapes.of(base.items).base : undefined;
        if (base && declaresProperties(base)) out[key] = t.field({ type: inner(base, ''), nullable, resolve });
        else if (items && declaresProperties(items)) out[key] = t.field({ type: [inner(items, 'Item')], nullable, resolve });
        else if (base?.type === 'integer') out[key] = t.int({ nullable, resolve });
        else if (base?.type === 'number') out[key] = t.float({ nullable, resolve });
        else if (base?.type === 'boolean') out[key] = t.boolean({ nullable, resolve });
        else out[key] = t.string({ nullable, resolve });
      }

      return out;
    },
  });

  return type;
}

function propertiesOf(shape: Shape): Record<string, Shape> {
  return 'properties' in shape ? (shape.properties ?? {}) as Record<string, Shape> : {};
}

function declaresProperties(shape: Shape): boolean {
  return shape.type === 'object' && Object.keys(propertiesOf(shape)).length > 0;
}

const nestedInputs = new WeakMap<object, Map<string, any>>();

const nestedObjects = new WeakMap<object, Map<string, any>>();

const enumTypes = new WeakMap<object, Map<string, { ref: any; values: string[] }>>();

const GRAPHQL_NAME = /^[_A-Za-z][_0-9A-Za-z]*$/;

function enumValuesOf(shape: Shape | undefined): string[] | undefined {
  const values = shape && 'enum' in shape ? shape.enum : undefined;
  if (!Array.isArray(values) || values.length === 0) return undefined;
  if (!values.every((v) => typeof v === 'string' && GRAPHQL_NAME.test(v))) return undefined;

  return values as string[];
}

export function enumTypeFor(
  builder: InstanceType<typeof SchemaBuilder>,
  name: string,
  values: string[],
): any | undefined {
  let perBuilder = enumTypes.get(builder as object);
  if (!perBuilder) enumTypes.set(builder as object, (perBuilder = new Map()));

  const known = perBuilder.get(name);
  if (known) {
    const same = known.values.length === values.length && known.values.every((v, i) => v === values[i]);

    return same ? known.ref : undefined;
  }

  const ref = (builder as any).enumType(name, { values });
  perBuilder.set(name, { ref, values });

  return ref;
}

export function enumNameFor(owner: string | undefined, fieldName: string): string | undefined {
  return owner ? `${owner}${upperFirst(fieldName)}` : undefined;
}

export function fieldToInput(
  t: any,
  field: Field,
  patch: boolean,
  nested?: (shape: Shape, suffix: string) => any,
  enumFor?: (values: string[]) => any | undefined,
): any {
  const { base: shape, nullable } = Shapes.of(field.shape);
  const required = !patch && !nullable && Lifecycle.of(field).requiredAtCreate();

  const values = enumFor && enumValuesOf(shape);
  if (values) {
    const ref = enumFor(values);
    if (ref) return t.field({ type: ref, required });
  }

  switch (shape?.type) {
    case 'integer':
      return t.int({ required });

    case 'number':
      return t.float({ required });

    case 'boolean':
      return t.boolean({ required });

    case 'array': {
      const items = Shapes.of(shape.items).base;
      switch (items?.type) {
        case 'integer': return t.intList({ required });
        case 'number': return t.floatList({ required });
        case 'boolean': return t.booleanList({ required });
        case 'object': {
          const built = nested?.(items, 'Item');

          return built ? t.field({ type: [built], required }) : t.stringList({ required });
        }
        default: return t.stringList({ required });
      }
    }

    case 'object': {
      const built = declaresProperties(shape) ? nested?.(shape, '') : undefined;

      return built ? t.field({ type: built, required }) : t.string({ required });
    }

    case 'string':
    default:
      return t.string({ required });
  }
}
