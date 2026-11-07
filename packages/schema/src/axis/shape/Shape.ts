import type { Schema } from '@cfworker/json-schema';
import type { JSONSchema7TypeName } from 'json-schema';
import type { StringFormat } from './StringFormat.js';
import type { ShapeType } from './ShapeType.js';

type Nullably<T extends string> = T | readonly [T, 'null'];

/** The keywords the engine judges — its own type, less the index signature and its `__` bookkeeping. */
export type Judged = keyof { [K in keyof Schema as string extends K ? never : K extends `__${string}` ? never : K]: true };

interface Narrowed {
  type: Nullably<(typeof SHAPE_TYPES)[number]>;
  items?: Shape;
  prefixItems?: readonly Shape[];
  enum?: readonly (string | number | null)[];
  const?: string | number;
  format?: StringFormat;
  required?: readonly string[];
  properties?: Record<string, unknown>;
  additionalProperties?: boolean | Shape;
  propertyNames?: Shape;
  title?: string;
  description?: string;
  deprecated?: boolean;
  examples?: readonly unknown[];
}

export type Shape = Omit<Pick<Schema, Judged>, keyof Narrowed> & Narrowed;

export const SHAPE_TYPES = [
  'string',
  'number',
  'integer',
  'boolean',
  'array',
  'object',
] as const;


type BaseShape = Shape extends infer Each
  ? Each extends { type: infer Type } ? Omit<Each, 'type'> & { type: Type extends readonly [infer One, 'null'] ? One : Type } : never
  : never;

interface ShapeParts {
  base?: BaseShape;
  nullable: boolean;
}

type Assert<T extends true> = T;

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

  /** Every `pattern` a shape states, nested ones included. */
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
   * Adds `null` to a shape, and to its `enum`.
   * Ex: `{ type: 'string', enum: ['draft'] }` → `{ type: ['string','null'], enum: ['draft', null] }`.
   */
  static nullable(shape: Shape): Shape {
    if (typeof shape.type !== 'string') return shape;

    const nullable: Shape = { ...shape, type: [shape.type, 'null'] };
    if (shape.enum && !shape.enum.includes(null)) nullable.enum = [...shape.enum, null];

    return nullable;
  }

  /** Every type name a shape states — none, since a card may carry a property with no `type`. */
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
   * A text value, read as the shape declares it.
   * Ex: `fromText({ type: 'integer' }, '12')` → `12`, and `'abc'` stays `'abc'`.
   */
  static fromText(shape: Shape | undefined, value: unknown): unknown {
    const type = this.of(shape).base?.type;
    if (typeof value !== 'string' || value.trim() === '') return value;

    if (type === 'number' || type === 'integer') {
      const number = Number(value);

      return Number.isFinite(number) ? number : value;
    }
    if (type === 'boolean') return Shapes.BOOLEANS[value] ?? value;
    if (type === 'object' || type === 'array') return Shapes.json(value);

    return value;
  }

  private static readonly BOOLEANS: Readonly<Record<string, boolean>> = { true: true, false: false, 1: true, 0: false };

  private static json(text: string): unknown {
    try {
      return JSON.parse(text);
    } catch {
      return text;
    }
  }

  /** The shape's type, with `date` and `choice` told apart from `string`. */
  static typeOf(shape?: Shape): ShapeType | undefined {
    const base = this.of(shape).base;
    if (!base) return undefined;
    if (base.type !== 'string') return base.type;
    if (base.format === 'date-time') return 'date';

    return base.enum?.length ? 'choice' : 'text';
  }
}
