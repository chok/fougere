import type { JSONSchema7 } from 'json-schema';
import type { StringFormat } from './Formats.js';

type Nullably<T extends string> = T | readonly [T, 'null'];

interface StringConstraints { minLength?: number; maxLength?: number; pattern?: string; enum?: readonly (string | null)[]; format?: StringFormat }
interface NumericConstraints { minimum?: number; maximum?: number }
interface ArrayConstraints { items?: Shape; minItems?: number; maxItems?: number }
interface ObjectConstraints { properties?: Record<string, unknown>; required?: readonly string[]; additionalProperties?: boolean | Shape; propertyNames?: Shape }

export type Shape =
  | ({ type: Nullably<'string'> } & StringConstraints)
  | ({ type: Nullably<'number'> | Nullably<'integer'> } & NumericConstraints)
  | { type: Nullably<'boolean'> }
  | ({ type: Nullably<'array'> } & ArrayConstraints)
  | ({ type: Nullably<'object'> } & ObjectConstraints);

const SHAPE_TYPES = ['string', 'number', 'integer', 'boolean', 'array', 'object'] as const;

function isShapeImpl(value: unknown): value is Shape {
  if (typeof value !== 'object' || value === null) return false;
  const type = (value as Shape).type;
  const names = Array.isArray(type) ? type : [type];
  return (
    names.some((name) => (SHAPE_TYPES as readonly unknown[]).includes(name)) &&
    names.every((name) => name === 'null' || (SHAPE_TYPES as readonly unknown[]).includes(name))
  );
}

type BaseShape =
  | ({ type: 'string' } & StringConstraints)
  | ({ type: 'number' | 'integer' } & NumericConstraints)
  | { type: 'boolean' }
  | ({ type: 'array' } & ArrayConstraints)
  | ({ type: 'object' } & ObjectConstraints);

function nullableShapeImpl(shape: Shape): Shape {
  if (Array.isArray(shape.type)) return shape;
  const nullable = { ...shape, type: [shape.type, 'null'] } as unknown as Shape;
  if ('enum' in nullable && nullable.enum && !nullable.enum.includes(null)) {
    (nullable as { enum: readonly (string | null)[] }).enum = [...nullable.enum, null];
  }
  return nullable;
}

interface ShapeParts {
  base?: BaseShape;
  nullable: boolean;
}

export class Shapes {
  static is(value: unknown): value is Shape {
    return isShapeImpl(value);
  }

  static nullable(shape: Shape): Shape {
    return nullableShapeImpl(shape);
  }

  private static readonly cache = new WeakMap<object, ShapeParts>();
  private static readonly none: ShapeParts = { base: undefined, nullable: false };

  static of(shape?: Shape): ShapeParts {
    if (!shape) return this.none;
    let parts = this.cache.get(shape);
    if (!parts) {
      if (Array.isArray(shape.type)) {
        const baseType = shape.type.find((t) => t !== 'null');
        const base = { ...shape, type: baseType } as BaseShape;
        if ('enum' in base && base.enum) {
          (base as { enum: readonly (string | null)[] }).enum = base.enum.filter((v) => v !== null);
        }
        parts = { base, nullable: true };
      } else {
        parts = { base: shape as BaseShape, nullable: false };
      }
      this.cache.set(shape, parts);
    }
    return parts;
  }

  static isNullable(shape?: Shape): boolean {
    return this.of(shape).nullable;
  }
}

type Assert<T extends true> = T;
type ShapeKeys<T> = T extends unknown ? keyof T : never;
type _ShapeConformsToJsonSchema = Assert<
  [Exclude<ShapeKeys<Shape>, keyof JSONSchema7>] extends [never] ? true : false
>;
