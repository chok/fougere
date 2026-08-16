// The primitive — a Field decomposed on four orthogonal axes plus the meta
// compartment. Each axis lives in its own file; this barrel is the
// package-internal (and index-level) view.
export {
  type Shape,
  type ShapeType,
  Anatomy,
} from "./shape.js";
export { Formats, type FormatPredicate, type StringFormat } from "./format.js";
export {
  type Role,
  type Relation,
  type EntityConstructor,
  toTargetThunk,
} from "./role/role.js";
export { FieldGroup } from "./role/group.js";
export {
  Unique,
  type CompositeUnique,
  type EntityDeclarations,
} from "./role/unique.js";
export {
  Lifecycle,
  type LifecycleRules,
  type GeneratorRef,
  registerGenerator,
  resolveCustomGenerator,
} from "./lifecycle/lifecycle.js";
export {
  Boundary,
  type BoundaryRules,
  type BoundaryRef,
  type Decoder,
  type Encoder,
  Boundaries,
} from "./boundary/boundary.js";
export { type Meta } from "./meta.js";
export {
  Field,
  type Fields,
} from "./field.js";

export { type Axis, type Resolver } from "./axis.js";
export { EXTENSION_AXES } from "./axes.js";
export { applyCreate, applyUpdate } from "./lifecycle/apply.js";
