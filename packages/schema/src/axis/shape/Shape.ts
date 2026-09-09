import type { JSONSchema7, JSONSchema7TypeName } from 'json-schema';
import type { StringFormat } from './Formats.js';

/**
 * The standard's own list, less `null` — a shape states that as the `[T,'null']` union —
 * and with `string` in the three forms every projection here tells apart: a `date()`, a
 * bounded set, and everything else. Those three are the whole of what this package adds.
 */
export type ShapeType =
  | Exclude<JSONSchema7TypeName, 'null' | 'string'>
  | 'text'
  | 'date'
  | 'choice';

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

type BaseShape =
  | ({ type: 'string' } & StringConstraints)
  | ({ type: 'number' | 'integer' } & NumericConstraints)
  | { type: 'boolean' }
  | ({ type: 'array' } & ArrayConstraints)
  | ({ type: 'object' } & ObjectConstraints);

interface ShapeParts {
  base?: BaseShape;
  nullable: boolean;
}

export class Shapes {
  static is(value: unknown): value is Shape {
    if (typeof value !== 'object' || value === null) return false;
    const type = (value as Shape).type;
    const names = Array.isArray(type) ? type : [type];

    return (
      names.some((name) => (SHAPE_TYPES as readonly unknown[]).includes(name)) &&
      names.every((name) => name === 'null' || (SHAPE_TYPES as readonly unknown[]).includes(name))
    );
  }

  /**
   * Every `pattern` a shape states, the nested ones included — `items`, `properties`.
   *
   * Two readers ask two questions of the same list: the card door asks whether each one
   * compiles, `fougere check` whether each one backtracks. Neither owns the walk.
   */
  static patterns(shape: unknown): string[] {
    const found: string[] = [];
    Shapes.collectPatterns(shape, found);

    return found;
  }

  private static collectPatterns(value: unknown, found: string[]): void {
    if (Array.isArray(value)) {
      for (const member of value) Shapes.collectPatterns(member, found);

      return;
    }
    if (typeof value !== 'object' || value === null) return;

    const { pattern } = value as { pattern?: unknown };
    if (typeof pattern === 'string') found.push(pattern);

    for (const member of Object.values(value)) Shapes.collectPatterns(member, found);
  }

  static nullable(shape: Shape): Shape {
    if (Array.isArray(shape.type)) return shape;
    const nullable = { ...shape, type: [shape.type, 'null'] } as unknown as Shape;
    if ('enum' in nullable && nullable.enum && !nullable.enum.includes(null)) {
      (nullable as { enum: readonly (string | null)[] }).enum = [...nullable.enum, null];
    }

    return nullable;
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

  /**
   * The type a projection dispatches on, which is `shape.type` except that a `string`
   * answers `date` or `choice` where it states one. Read off the base, so the nullable
   * union answers like the bare type.
   * FR : le type sur lequel une projection branche — `shape.type`, mais une chaîne répond
   * `date` ou `choice` quand elle l'énonce.
   * `typeOf({ type: ['string', 'null'], format: 'date-time' })` → `'date'`
   */
  static typeOf(shape?: Shape): ShapeType | undefined {
    const base = this.of(shape).base;
    if (!base) return undefined;
    if (base.type !== 'string') return base.type;
    if (base.format === 'date-time') return 'date';

    return base.enum?.length ? 'choice' : 'text';
  }
}

type Assert<T extends true> = T;
type ShapeKeys<T> = T extends unknown ? keyof T : never;
type _ShapeConformsToJsonSchema = Assert<
  [Exclude<ShapeKeys<Shape>, keyof JSONSchema7>] extends [never] ? true : false
>;
type _ShapeTypesAreTheStandardsLessNull = Assert<
  [Exclude<Exclude<JSONSchema7TypeName, 'null'>, (typeof SHAPE_TYPES)[number]>] extends [never]
    ? true
    : false
>;
