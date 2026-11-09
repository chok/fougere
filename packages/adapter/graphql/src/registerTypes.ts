import { upperFirst, Role } from '@fougere/schema';
import type SchemaBuilder from '@pothos/core';
import type { Entity } from '@fougere/schema';
import { Boundary, Card } from '@fougere/schema';
import type { TypeConfig } from './TypeConfig.js';
import type { InputConfig } from './InputConfig.js';
import type { ObjectFieldDef } from './ObjectFieldDef.js';
import { enumNameFor, enumTypeFor, fieldToGraphQL, fieldToInput, nestedInputType, nestedObjectType } from './fieldTypes.js';

type ScalarName = 'string' | 'int' | 'float' | 'boolean';

const SCALARS: Record<ScalarName, (t: any, opts: any) => any> = {
  string:  (t, o) => o.nullable ? t.string(o)  : t.string(o),
  int:     (t, o) => o.nullable ? t.int(o)     : t.int(o),
  float:   (t, o) => o.nullable ? t.float(o)   : t.float(o),
  boolean: (t, o) => o.nullable ? t.boolean(o) : t.boolean(o),
};

function isScalar(type: unknown): type is ScalarName {
  return typeof type === 'string' && type in SCALARS;
}


/** Register a GraphQL object type from a declarative field map. */
export function registerObjectType(
  builder: InstanceType<typeof SchemaBuilder>,
  name: string,
  fieldDefs: Record<string, ObjectFieldDef>,
): any {
  return (builder as any).objectRef(name).implement({
    fields: (t: any) => {
      const result: Record<string, any> = {};
      for (const [key, def] of Object.entries(fieldDefs)) {
        const nullable = def.nullable ?? false;

        if (def.resolve) {
          if (Array.isArray(def.type)) {
            result[key] = t.field({ type: def.type, nullable, resolve: def.resolve });
          } else if (isScalar(def.type)) {
            result[key] = SCALARS[def.type](t, { nullable, resolve: def.resolve });
          } else {
            result[key] = t.field({ type: def.type, nullable, resolve: def.resolve });
          }
          continue;
        }

        if (isScalar(def.type)) {
          const expose = {
            string:  () => t.exposeString(key, { nullable }),
            int:     () => t.exposeInt(key, { nullable }),
            float:   () => t.exposeFloat(key, { nullable }),
            boolean: () => t.exposeBoolean(key, { nullable }),
          };
          result[key] = expose[def.type]();
        } else if (Array.isArray(def.type)) {
          result[key] = t.field({ type: def.type, nullable, resolve: (parent: any) => parent[key] });
        } else {
          result[key] = t.field({ type: def.type, nullable, resolve: (parent: any) => parent[key] });
        }
      }

      return result;
    },
  });
}


/** Enregistre un type GraphQL (lecture) depuis une entité fougere. */
export function registerType(builder: InstanceType<typeof SchemaBuilder>, config: TypeConfig): any {
  const schema = config.entity;
  const fields = schema.getFields();
  const exclude = new Set(config.exclude ?? []);
  const enumOwner = Card.fromSchema(schema).descriptor.title ?? config.name;

  return (builder as any).objectRef(config.name).implement({
    fields: (t: any) => {
      const result: Record<string, any> = {};

      for (const [fieldName, field] of Object.entries(fields)) {
        if (exclude.has(fieldName)) continue;
        if (Role.of(field).isCollection()) continue;
        if (config.relations?.[fieldName]) continue;
        if (Boundary.of(field).writeOnly()) continue;

        result[fieldName] = fieldToGraphQL(t, field, fieldName, (values) => {
          const name = enumNameFor(enumOwner, fieldName);

          return name ? enumTypeFor(builder, name, values) : undefined;
        }, (shape, suffix) => nestedObjectType(builder, shape, `${config.name}${upperFirst(fieldName)}${suffix}`));
      }

      if (config.relations) {
        for (const [name, rel] of Object.entries(config.relations)) {
          if (rel.list) {
            result[name] = t.field({
              type: [rel.type],
              resolve: rel.resolve,
            });
          } else {
            result[name] = t.field({
              type: rel.type,
              resolve: rel.resolve,
            });
          }
        }
      }

      if (config.presenter) {
        const allowed = config.presenterFields
          ? new Set(config.presenterFields)
          : null;
        const metaMap = new Map(
          (config.presenterFieldMeta ?? []).map((m) => [m.name, m]),
        );
        const names = config.presenterFields ?? Object.getOwnPropertyNames(
          Object.getPrototypeOf(config.presenter),
        );
        for (const name of names) {
          if (name === 'constructor') continue;
          if (allowed && !allowed.has(name)) continue;
          if (result[name]) continue; // entity field takes precedence
          const fn = (config.presenter as Record<string, unknown>)[name];
          if (typeof fn !== 'function') continue;

          const meta = metaMap.get(name);
          const nullable = meta?.nullable ?? true;
          const resolve = (parent: any) => parent?.[name] ?? null;

          const declared = config.presenterViews?.[name];
          if (declared && config.viewType) {
            const isList = Array.isArray(declared);
            const view = (isList ? declared[0] : declared) as Entity;
            const viewRef = config.viewType(view, name);
            result[name] = t.field({ type: isList ? [viewRef] : viewRef, nullable, resolve });
            continue;
          }

          const many = meta?.list === true;
          switch (meta?.returnType) {
            case 'number':
              result[name] = many ? t.floatList({ nullable, resolve }) : t.float({ nullable, resolve });
              break;
            case 'boolean':
              result[name] = many ? t.booleanList({ nullable, resolve }) : t.boolean({ nullable, resolve });
              break;
            case 'string':
              result[name] = many ? t.stringList({ nullable, resolve }) : t.string({ nullable, resolve });
              break;
            default:
              result[name] = t.string({
                nullable,
                resolve: async (parent: any) => {
                  const value = await resolve(parent);
                  if (value == null) return null;

                  return typeof value === 'string' ? value : JSON.stringify(value);
                },
              });
              break;
          }
        }
      }

      return result;
    },
  });
}

/** The GraphQL input for EXACTLY this view — or none, when the view asks for nothing. */
export function registerInput(builder: InstanceType<typeof SchemaBuilder>, config: InputConfig): any {
  const fields = Object.fromEntries(
    Object.entries(config.schema.getFields())
      .filter(([, field]) => !Role.of(field).isCollection() && !Boundary.of(field).readOnly()),
  );
  if (Object.keys(fields).length === 0) return undefined;
  const enumOwner = Card.fromSchema(config.schema).descriptor.title;
  const patch = config.schema.getOpts().patch ?? false;

  return (builder as any).inputType(config.name, {
    fields: (t: any) => {
      const result: Record<string, any> = {};

      for (const [fieldName, field] of Object.entries(fields)) {
        result[fieldName] = fieldToInput(
          t, field, patch,
          (shape, suffix) => nestedInputType(builder, shape, `${config.name}${upperFirst(fieldName)}${suffix}`),
          (values) => {
            const name = enumNameFor(enumOwner, fieldName);

            return name ? enumTypeFor(builder, name, values) : undefined;
          },
        );
      }

      return result;
    },
  });
}
