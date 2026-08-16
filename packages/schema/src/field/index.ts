// The primitive — a Field decomposed on four orthogonal axes plus the meta
// compartment. Each axis lives in its own file; this barrel is the
// package-internal (and index-level) view.
export {
  type Shape,
  SHAPE_TYPES,
  type ShapeType,
  type BaseShape,
  type ShapeAnatomy,
  Anatomy,
} from "./shape.js";
export { Formats, type FormatPredicate, type StringFormat } from "./format.js";
export {
  type Role,
  type Relation,
  type EntityConstructor,
  toTargetThunk,
} from "./role.js";
export { FieldGroup } from "./group.js";
export {
  Unique,
  type CompositeUnique,
  type EntityDeclarations,
} from "./unique.js";
export {
  Lifecycle,
  type LifecycleRules,
  type GeneratorRef,
  registerGenerator,
  resolveCustomGenerator,
} from "./lifecycle.js";
export {
  Boundary,
  type BoundaryRules,
  type BoundaryRef,
  type Decoder,
  type Encoder,
  Boundaries,
} from "./boundary.js";
export { type Meta } from "./meta.js";
export {
  Field,
  type Fields,
  type FieldData,
} from "./field.js";
