import type { JSONSchema7, JSONSchema7TypeName } from 'json-schema';
import type { StringFormat } from './StringFormat.js';
import type { ShapeType } from './ShapeType.js';

type Nullably<T extends string> = T | readonly [T, 'null'];

/** The sentence a field carries, where JSON Schema already holds one. */
interface Documented {
  description?: string;
}

interface StringConstraints extends Documented {
  minLength?: number;
  maxLength?: number;
  pattern?: string;
  enum?: readonly (string | null)[];
  format?: StringFormat;
}

interface NumericConstraints extends Documented {
  minimum?: number;
  maximum?: number;
  enum?: readonly (number | null)[];
}

interface ArrayConstraints extends Documented {
  items?: Shape;
  minItems?: number;
  maxItems?: number;
}

interface ObjectConstraints extends Documented {
  properties?: Record<string, unknown>;
  required?: readonly string[];
  additionalProperties?: boolean | Shape;
  propertyNames?: Shape;
}

export type Shape =
  | ({ type: Nullably<'string'> } & StringConstraints)
  | ({ type: Nullably<'number'> | Nullably<'integer'> } & NumericConstraints)
  | ({ type: Nullably<'boolean'> } & Documented)
  | ({ type: Nullably<'array'> } & ArrayConstraints)
  | ({ type: Nullably<'object'> } & ObjectConstraints);

export const SHAPE_TYPES = [
  'string',
  'number',
  'integer',
  'boolean',
  'array',
  'object',
] as const;

type BaseShape =
  | ({ type: 'string' } & StringConstraints)
  | ({ type: 'number' | 'integer' } & NumericConstraints)
  | ({ type: 'boolean' } & Documented)
  | ({ type: 'array' } & ArrayConstraints)
  | ({ type: 'object' } & ObjectConstraints);

interface ShapeParts {
  base?: BaseShape;
  nullable: boolean;
}

type Assert<T extends true> = T;

type ShapeKeys<T> = T extends unknown ? keyof T : never;

type _ShapeConformsToJsonSchema = Assert<
  [Exclude<ShapeKeys<Shape>, keyof JSONSchema7>] extends [never] ? true : false
>;

type _ShapeTypesAreTheStandardsLessNull = Assert<
  [Exclude<Exclude<JSONSchema7TypeName, 'null'>, (typeof SHAPE_TYPES)[number]>] extends [
    never,
  ]
    ? true
    : false
>;

export class Shapes {
  private static readonly cache = new WeakMap<object, ShapeParts>();
  private static readonly none: ShapeParts = { base: undefined, nullable: false };

  /**
   * Every `pattern` a shape states, the nested ones included — `items`, `properties`.
   *
   * Two readers ask two questions of the same list: the card facade asks whether each one
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

  /**
   * `null` enters the grammar, and every constraint stays. It is added when it is ABSENT,
   * read off the shape rather than assumed from its form — a shape already stating it comes
   * back as itself, so `optional(nullable(text()))` does the work once.
   *
   * `enum` is widened TOO, because JSON Schema checks it apart from `type`: a shape saying
   * `['string','null']` and `enum: ['draft','live']` calls null a legal type and not a legal
   * value, and the engine answers `Instance does not match any of ["draft","live"]`.
   *
   * `{ type: 'string', minLength: 3 }`      → `{ type: ['string','null'], minLength: 3 }`
   * `{ type: 'string', enum: ['draft'] }`   → `{ type: ['string','null'], enum: ['draft', null] }`
   */
  static nullable(shape: Shape): Shape {
    const types = Shapes.typesOf(shape);
    if (types.includes('null')) return shape;

    const nullable = { ...shape, type: [...types, 'null'] } as unknown as Shape;
    if ('enum' in nullable && nullable.enum && !nullable.enum.includes(null)) {
      (nullable as { enum: readonly (string | number | null)[] }).enum = [
        ...nullable.enum,
        null,
      ];
    }

    return nullable;
  }

  /**
   * Every type name a shape states, whether it states one, a union of them, or none — a card
   * may carry a property with no `type`.
   */
  static typesOf(shape: { type?: string | readonly string[] }): readonly string[] {
    if (shape.type === undefined) return [];

    return typeof shape.type === 'string' ? [shape.type] : shape.type;
  }

  static of(shape?: Shape): ShapeParts {
    if (!shape) return this.none;
    let parts = this.cache.get(shape);
    if (!parts) {
      if (Array.isArray(shape.type)) {
        const baseType = shape.type.find((t) => t !== 'null');
        const base = { ...shape, type: baseType } as BaseShape;
        if ('enum' in base && base.enum) {
          (base as { enum: readonly (string | number | null)[] }).enum = base.enum.filter(
            (v) => v !== null,
          );
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
   * A value that came in as text — a form control, a command-line flag — read as the shape
   * declares it. What does not read that way stays as it came, for the judge to refuse by name.
   * `fromText({ type: 'integer' }, '12')` → `12`, and `fromText({ type: 'integer' }, 'abc')` → `'abc'`
   */
  static fromText(shape: Shape | undefined, value: unknown): unknown {
    const type = this.of(shape).base?.type;

    if (
      (type !== 'number' && type !== 'integer') ||
      typeof value !== 'string' ||
      value === ''
    )
      return value;

    const number = Number(value);

    return Number.isFinite(number) ? number : value;
  }

  /**
   * `shape.type` read off the base, except that a `string` answers `date` or `choice`.
   * FR : `shape.type` lu sur la base, sauf qu'une chaîne répond `date` ou `choice`.
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
