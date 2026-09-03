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
  const declared = (value as Shape).type;
  const names = Array.isArray(declared) ? declared : [declared];
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
  const out = { ...shape, type: [shape.type, 'null'] } as unknown as Shape;
  if ('enum' in out && out.enum && !out.enum.includes(null)) {
    (out as { enum: readonly (string | null)[] }).enum = [...out.enum, null];
  }
  return out;
}

interface ShapeAnatomy {
  base?: BaseShape;
  nullable: boolean;
}

export class Anatomy {
  /**
   * So a shape is recognized by the type it states, and anything else is refused.
   * FR : pour qu'une forme soit reconnue au type qu'elle énonce.
   * `Anatomy.is({ type: 'string' })` → `true`; `Anatomy.is({ type: 'blob' })` → `false`
   */
  static is(value: unknown): value is Shape {
    return isShapeImpl(value);
  }

  /**
   * So `null` is added to a shape without the caller knowing how a nullable type is spelled.
   * FR : pour qu'on ajoute `null` sans savoir comment s'écrit un type nullable.
   * `Anatomy.nullable({ type: 'string' })` → `{ type: ['string', 'null'] }`
   */
  static nullable(shape: Shape): Shape {
    return nullableShapeImpl(shape);
  }

  private static readonly cache = new WeakMap<object, ShapeAnatomy>();
  private static readonly none: ShapeAnatomy = { base: undefined, nullable: false };

  /**
   * So every reader sees the shape and its nullability apart.
   * FR : pour que la forme et sa nullabilité se lisent séparément.
   * `Anatomy.of({ type: ['string', 'null'], enum: ['a', null] })`
   * → `{ base: { type: 'string', enum: ['a'] }, nullable: true }`
   */
  static of(shape?: Shape): ShapeAnatomy {
    if (!shape) return this.none;
    let a = this.cache.get(shape);
    if (!a) {
      if (Array.isArray(shape.type)) {
        const baseType = shape.type.find((t) => t !== 'null');
        const base = { ...shape, type: baseType } as BaseShape;
        if ('enum' in base && base.enum) {
          (base as { enum: readonly (string | null)[] }).enum = base.enum.filter((v) => v !== null);
        }
        a = { base, nullable: true };
      } else {
        a = { base: shape as BaseShape, nullable: false };
      }
      this.cache.set(shape, a);
    }
    return a;
  }

  /**
   * So the question every adapter asks costs one call instead of an anatomy to read.
   * FR : pour que la question de chaque adaptateur coûte un appel.
   * `Anatomy.isNullable({ type: ['string', 'null'] })` → `true`
   */
  static isNullable(shape?: Shape): boolean {
    return this.of(shape).nullable;
  }
}

type Assert<T extends true> = T;
type ShapeKeys<T> = T extends unknown ? keyof T : never;
type _ShapeConformsToJsonSchema = Assert<
  [Exclude<ShapeKeys<Shape>, keyof JSONSchema7>] extends [never] ? true : false
>;
