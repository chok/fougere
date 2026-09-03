import type { BoundaryRef } from '../../schema/axis/boundary/Boundary.js';
import type { LifecycleRules } from '../../schema/axis/lifecycle/Lifecycle.js';
import type { Relation } from '../../schema/axis/role/Relation.js';
import type { RoleRules } from '../../schema/axis/role/Role.js';
import type { Shape } from '../../schema/axis/shape/Shape.js';

type JsonSchemaType =
  | 'string'
  | 'number'
  | 'integer'
  | 'boolean'
  | 'object'
  | 'array'
  | 'null';

type ShapeKeywords = UnionToIntersection<KeywordsOf<Shape>>;

type KeywordsOf<S> = S extends unknown ? Partial<Omit<S, 'type' | 'items' | 'properties'>> : never;
type UnionToIntersection<U> = (U extends unknown ? (k: U) => void : never) extends (k: infer I) => void ? I : never;

export type FieldDescriptor = ShapeKeywords & {
  type?: JsonSchemaType | JsonSchemaType[];
  items?: FieldDescriptor;
  properties?: Record<string, FieldDescriptor>;
  description?: string;
  'x-fougere'?: FieldExtension;
};

export interface FieldExtension {
  role?: RoleDescriptor;
  lifecycle?: LifecycleRules;
  boundary?: BoundaryRef;
}

export type RoleDescriptor = Pick<RoleRules, 'primary' | 'index'> & {
  unique?: string[][];
  relation?: RelationDescriptor;
};

export type RelationDescriptor = Pick<Relation, 'kind' | 'onDelete'> & { to: string };

/**
 * What a derivation was cut from, and what the cut left — `here` keyed by the
 * ORIGIN's field names. Absent on a declaration that derives from nothing.
 *
 * A dropped field is `null` and never `undefined`: JSON.stringify erases the second,
 * which would leave the card saying only what remains — what `properties` already says.
 */
export interface DerivedFrom {
  from: string;
  here: Record<string, string | null>;
}

export interface SchemaDescriptor {
  title?: string;
  type: 'object';
  properties: Record<string, FieldDescriptor>;
  required?: string[];
  'x-fougere-derived'?: DerivedFrom;
  'x-fougere-version': 1;
  'x-fougere-vendor': 'fougere';
}

export interface SchemaBundle {
  $defs: Record<string, SchemaDescriptor>;
  'x-fougere-version': 1;
  'x-fougere-vendor': 'fougere';
}
