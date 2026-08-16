// ─── The primitive — a Field on four orthogonal axes + meta ──
export { Field, type Fields } from './Field.js';
export { type Shape, type ShapeType, Anatomy } from './axis/shape/Shape.js';
export { type StringFormat, type FormatPredicate, Formats } from './axis/shape/Formats.js';
export { type Role } from './axis/role/Role.js';
export { type Relation, type EntityConstructor } from './axis/role/Relation.js';
export { Lifecycle, type LifecycleRules } from './axis/lifecycle/Lifecycle.js';
export { type GeneratorRef, registerGenerator, resolveCustomGenerator } from './axis/lifecycle/Generators.js';
export { Boundary, type BoundaryRules, type BoundaryRef } from './axis/boundary/Boundary.js';
export { type Decoder, type Encoder, Boundaries } from './axis/boundary/Boundaries.js';
export { type Meta } from './axis/Meta.js';
export { FieldGroup } from './axis/role/FieldGroup.js';
export { Unique } from './axis/role/Unique.js';

// ─── The carrier and its derivation algebra ──────────────────
export { Schema, ANONYMOUS_SCHEMA_NAME, type SchemaConstructor } from './Schema.js';
export { type SchemaView, type Row, type PartialRow } from './SchemaView.js';
export { type FougereHints, type Hints } from './EntityDeclarations.js';


// ─── The vocabulary — field constructors and transforms ──────
export { primary } from './vocabulary/primary.js';
export { text, type TextOptions } from './vocabulary/text.js';
export { email } from './vocabulary/email.js';
export { url } from './vocabulary/url.js';
export { list, type ListOptions } from './vocabulary/list.js';
export { number } from './vocabulary/number.js';
export { bool } from './vocabulary/bool.js';
export { date } from './vocabulary/date.js';
export { created } from './vocabulary/created.js';
export { updated } from './vocabulary/updated.js';
export { oneOf } from './vocabulary/oneOf.js';
export { ref } from './vocabulary/ref.js';
export { many } from './vocabulary/many.js';
export { optional } from './vocabulary/optional.js';
export { nullable } from './vocabulary/nullable.js';
export { immutable } from './vocabulary/immutable.js';
export { unique } from './vocabulary/unique.js';
export { indexed } from './vocabulary/indexed.js';
export { readOnly } from './vocabulary/readOnly.js';
export { writeOnly } from './vocabulary/writeOnly.js';
export { json } from './vocabulary/json.js';

// ─── Projections — consumers of the axes ─────────────────────
// lifecycle: the axis → the values the system writes. The dual of validation — the
// judge never fills a hole, this is what fills it, and a storage adapter calls it
// instead of re-deriving the rule.
export { applyCreate, applyUpdate } from './axis/lifecycle/apply.js';
export { encodeFields } from './projection/encode.js';
// io: the dual client-surface projections — ingress (may supply) / egress (may read)
export { inputFields, outputFields } from './projection/io.js';
export { registrationKeyOf } from './name.js';
// descriptor (the card): the portable, serialisable identity of a schema
export { describe, describeSet, sourceNameOf } from './card/describe.js';
export { reconstruct, reconstructSet } from './card/reconstruct.js';
export { entitySourceOf, facadeTypeSourceOf, type TypeSourceOptions, type OpDescriptor } from './card/typescript.js';
export { type SchemaBundle, type SchemaDescriptor, type FieldDescriptor, type FieldExtension, type RoleDescriptor, type RelationDescriptor } from './card/Descriptor.js';
// source: the one reader that takes a live class OR a card — what an adapter stands on
export { type SchemaSource, schemaOf, fieldsOf } from './projection/source.js';
export type { StandardSchemaV1 } from './projection/standard.js';

export { entity } from './entity.js';

export { Judge } from './judge/Judge.js';
export { type ValidateOptions } from './judge/options.js';
export { type ValidationError, type ValidationResult, type Checked } from './judge/result.js';
