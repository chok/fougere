// The primitive — a Field decomposed on four orthogonal axes plus the meta
// compartment. Each axis lives in its own file; this barrel is the
// package-internal (and index-level) view.
export {
  type Shape,
  SHAPE_TYPES,
  isShape,
  type ShapeType,
  type BaseShape,
  type ShapeAnatomy,
  nullableShape,
  Anatomy,
} from "./shape.js";
export { Formats, type FormatPredicate, type StringFormat } from "./format.js";
export {
  type Role,
  type Relation,
  type EntityConstructor,
  toTargetThunk,
  uniqueMembers,
} from "./role.js";
export {
  type Lifecycle,
  type GeneratorRef,
  registerGenerator,
  resolveCustomGenerator,
} from "./lifecycle.js";
export {
  type Boundary,
  type BoundaryRef,
  type Decoder,
  type Encoder,
  resolveBoundary,
  declaredBoundary,
  boundaryOf,
  Boundaries,
} from "./boundary.js";
export { type Meta } from "./meta.js";
export {
  Field,
  type Fields,
  type FieldData,
} from "./field.js";
