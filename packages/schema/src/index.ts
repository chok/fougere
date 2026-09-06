export { entity } from './entity.js';

export * from './vocabulary/index.js';

export { Schema, ANONYMOUS_SCHEMA_NAME, type SchemaConstructor } from './Schema.js';
export { type SchemaView } from './SchemaView.js';
export { Field, type Fields } from './field/Field.js';
export { FieldSet } from './field/FieldSet.js';
export { type Shape, Shapes } from './axis/shape/Shape.js';
export { Role } from './axis/role/Role.js';
export { type EntityConstructor } from './axis/role/Relation.js';
export { Lifecycle, type LifecycleRules } from './axis/lifecycle/Lifecycle.js';
export { Boundary, type BoundaryRef } from './axis/boundary/Boundary.js';
export { applyCreate, applyUpdate } from './axis/lifecycle/apply.js';
export { InputRefusal } from './validator/InputRefusal.js';
export { type ValidationError, type ValidationResult } from './validation.js';

export { Card } from './projection/card/Card.js';
export { Bundle } from './projection/card/Bundle.js';
export { Visibility } from './projection/Visibility.js';
export { Cases, type ValidationCase } from './projection/Cases.js';
export type {
  SchemaBundle,
  SchemaDescriptor,
  DerivedFrom,
  FieldDescriptor,
  FieldExtension,
  RoleDescriptor,
  RelationDescriptor,
} from './projection/card/Descriptor.js';
export type {
  Change,
  Diff,
  DiffOptions,
  SetDiff,
  SetDiffOptions,
  RenameCandidate,
  TypeSet,
} from './projection/card/diff.js';

export * from './lib/index.js';
export { Formats } from './axis/shape/Formats.js';
export { Generators } from './axis/lifecycle/Generators.js';
export { Boundaries } from './axis/boundary/Boundaries.js';
export { Clock } from './axis/lifecycle/Clock.js';
export { type FougereEntityAdapters } from './entity/EntityAdapters.js';
export { InputValidator } from './validator/InputValidator.js';
export { FieldValueValidator } from './validator/FieldValueValidator.js';
export { AdapterFieldValidator } from './validator/AdapterFieldValidator.js';
