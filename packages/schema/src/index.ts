// ─── The primitive — a Field on four orthogonal axes + meta ──
export {
  type Field,
  type AnyField,
  type Fields,
  type Shape,
  type ShapeType,
  type BaseShape,
  type ShapeAnatomy,
  type StringFormat,
  type Role,
  type Relation,
  type Lifecycle,
  type GeneratorRef,
  type SchemaLike,
  type Boundary,
  type BoundaryRef,
  type Decoder,
  type Encoder,
  type Meta,
  isField,
  cloneField,
  nullableShape,
  anatomy,
  isNullable,
  registerGenerator,
  resolveCustomGenerator,
  resolveBoundary,
  declaredBoundary,
  boundaryOf,
  registerDecoder,
  registerEncoder,
  registerBoundaryAlias,
  // Public because a relation CYCLE needs it: `ref(() => Captain)` defers the value,
  // not the type, so inferring one entity still requires the other. Annotating the
  // thunk with this cuts the inference loop — and `ref()` returns `Field<string>`
  // whatever its target, so nothing is lost.
  type EntityConstructor,
} from './field/index.js';

// ─── The carrier and its derivation algebra ──────────────────
export {
  entity,
  compose,
  createSchemaConstructor,
  type SchemaConstructor,
  type SchemaViewInfer as InferView,
  type CtorInput,
} from './entity.js';
export { type FougereHints, type Hints } from './hints.js';

// ─── The vocabulary — field constructors and transforms ──────
export { primary } from './vocabulary/primary.js';
export { text, type TextOptions } from './vocabulary/text.js';
export { email } from './vocabulary/email.js';
export { url } from './vocabulary/url.js';
export { list, type ListOptions } from './vocabulary/list.js';
export { number } from './vocabulary/number.js';
export { bool } from './vocabulary/bool.js';
export { date } from './vocabulary/date.js';
export { auto } from './vocabulary/auto.js';
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
// validation: shape → ingress predicate (+ boundary decode)
export { type ValidationResult, type ValidationError, type Checked, validateFields, checkValue } from './projections/validation.js';
// encode: boundary → egress wire form (the dual of validation)
export { encodeFields } from './projections/encode.js';
// io: the dual client-surface projections — ingress (may supply) / egress (may read)
export { inputFields, outputFields } from './projections/io.js';
// descriptor (the card): the portable, serialisable identity of a schema
export { describe, describeSet } from './projections/describe.js';
export { reconstruct, reconstructSet } from './projections/reconstruct.js';
export {
  type SchemaBundle,
  type SchemaDescriptor,
  type FieldDescriptor,
  type FieldExtension,
  type RoleDescriptor,
  type RelationDescriptor,
  type JsonSchemaType,
} from './projections/card.js';
// standard: the live Standard Schema interop surface (`~standard`)
export type { StandardSchemaV1 } from './projections/standard.js';
