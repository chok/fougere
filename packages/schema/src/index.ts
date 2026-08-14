// ─── The primitive — a Field on four orthogonal axes + meta ──
export {
  Field,
  type Fields,
  type Shape,
  type ShapeType,
  type StringFormat,
  type FormatPredicate,
  type Role,
  type Relation,
  type Lifecycle,
  type GeneratorRef,
  type Boundary,
  type BoundaryRef,
  type Decoder,
  type Encoder,
  type Meta,
  validateField,
  isField,
  nullableShape,
  anatomy,
  // The constraint a `role.unique` member list denotes — `[]` means the field carrying it.
  uniqueMembers,
  isNullable,
  // The shape axis's own open registry — a NAMED predicate where JSON Schema
  // already declares its vocabulary open, so the rule travels as `format`.
  registerFormat,
  registerGenerator,
  resolveCustomGenerator,
  resolveBoundary,
  boundaryOf,
  registerDecoder,
  registerEncoder,
  registerBoundaryAlias,
  // Public because a relation CYCLE needs it: `ref(() => Captain)` defers the value,
  // not the type, so inferring one entity still requires the other. Annotating the
  // thunk with this cuts the inference loop — and `ref()` returns `Field<string>`
  // whatever its target, so nothing is lost.
  type EntityConstructor,
} from "./field/index.js";

// ─── The carrier and its derivation algebra ──────────────────
export {
  compose,
  Schema,
  ANONYMOUS_SCHEMA_NAME,
  type SchemaConstructor,
  type SchemaView,
  type Row,
  type PartialRow,
} from "./schema/index.js";
export { type FougereHints, type Hints } from "./hints.js";
export { type CompositeUnique, type EntityDeclarations } from "./unique.js";

// ─── The vocabulary — field constructors and transforms ──────
export { primary } from "./vocabulary/primary.js";
export { text, type TextOptions } from "./vocabulary/text.js";
export { email } from "./vocabulary/email.js";
export { url } from "./vocabulary/url.js";
export { list, type ListOptions } from "./vocabulary/list.js";
export { number } from "./vocabulary/number.js";
export { bool } from "./vocabulary/bool.js";
export { date } from "./vocabulary/date.js";
export { created } from "./vocabulary/created.js";
export { updated } from "./vocabulary/updated.js";
export { oneOf } from "./vocabulary/oneOf.js";
export { ref } from "./vocabulary/ref.js";
export { many } from "./vocabulary/many.js";
export { optional } from "./vocabulary/optional.js";
export { nullable } from "./vocabulary/nullable.js";
export { immutable } from "./vocabulary/immutable.js";
export { unique } from "./vocabulary/unique.js";
export { indexed } from "./vocabulary/indexed.js";
export { readOnly } from "./vocabulary/readOnly.js";
export { writeOnly } from "./vocabulary/writeOnly.js";
export { json } from "./vocabulary/json.js";

// ─── Projections — consumers of the axes ─────────────────────
// lifecycle: the axis → the values the system writes. The dual of validation — the
// judge never fills a hole, this is what fills it, and a storage adapter calls it
// instead of re-deriving the rule.
export { applyCreate, applyUpdate } from "./projections/lifecycle.js";
// validation: shape → ingress predicate (+ boundary decode)
export {
  type ValidationResult,
  type ValidationError,
  validateFields,
} from "./projections/validation.js";
export { checkValue, type Checked } from "./projections/check-value.js";
// encode: boundary → egress wire form (the dual of validation)
export { encodeFields } from "./projections/encode.js";
// io: the dual client-surface projections — ingress (may supply) / egress (may read)
export { inputFields, outputFields } from "./projections/io.js";
// name: the one spelling a schema is filed under, everywhere
export { registrationKeyOf } from "./name.js";
// descriptor (the card): the portable, serialisable identity of a schema
export { describe, describeSet, sourceNameOf } from "./projections/describe.js";
export { reconstruct, reconstructSet } from "./projections/reconstruct.js";
export {
  shapeTypeOf,
  entitySourceOf,
  facadeTypeSourceOf,
  type TypeSourceOptions,
  type OpDescriptor,
} from "./projections/typescript.js";
export {
  type SchemaBundle,
  type SchemaDescriptor,
  type FieldDescriptor,
  type FieldExtension,
  type RoleDescriptor,
  type RelationDescriptor,
} from "./projections/card.js";
// source: the one reader that takes a live class OR a card — what an adapter stands on
export {
  type SchemaSource,
  schemaOf,
  fieldsOf,
} from "./projections/source.js";
// standard: the live Standard Schema interop surface (`~standard`)
export type { StandardSchemaV1 } from "./projections/standard.js";

export { entity } from "./entity.js";
