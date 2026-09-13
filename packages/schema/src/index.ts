export { entity } from './entity.js';

export * from './vocabulary/index.js';

export { ANONYMOUS_SCHEMA_NAME, Schema } from './Schema.js';
export { type SchemaConstructor } from './SchemaConstructor.js';
export { type SchemaView } from './SchemaView.js';
export { Field } from './field/Field.js';
export { type Fields } from './field/Fields.js';
export { FieldSet } from './field/FieldSet.js';
export { type Shape } from './axis/shape/Shape.js';
export { type ShapeType } from './axis/shape/ShapeType.js';
export { Shapes } from './axis/shape/Shape.js';
export { Role } from './axis/role/Role.js';
export { type EntityConstructor } from './axis/role/EntityConstructor.js';
export { Lifecycle } from './axis/lifecycle/Lifecycle.js';
export { Boundary } from './axis/boundary/Boundary.js';
export { applyCreate, applyUpdate } from './axis/lifecycle/apply.js';
export { InputRefusal } from './validator/InputRefusal.js';
export { type ValidationError } from './lib/ValidationError.js';
export { dotted, type ValidationResult } from './lib/ValidationResult.js';

export { Card } from './projection/card/Card.js';
export { Bundle } from './projection/card/Bundle.js';
export { Visibility } from './projection/Visibility.js';
export { Cases } from './projection/Cases.js';
export { type ValidationCase } from './projection/ValidationCase.js';
export type { FieldDescriptor } from './projection/card/FieldDescriptor.js';
export type { SchemaBundle } from './projection/card/SchemaBundle.js';
export type { SchemaDescriptor } from './projection/card/SchemaDescriptor.js';
export type {
  Change,
  Diff,
  SetDiff,
  SetDiffOptions,
} from './projection/card/diff.js';

export * from './lib/index.js';
export { Formats } from './axis/shape/Formats.js';
export { Generators } from './axis/lifecycle/Generators.js';
export { Boundaries } from './axis/boundary/Decoder.js';
export { Clock } from './axis/lifecycle/Clock.js';
export { type FougereEntityAdapters } from './entity/FougereEntityAdapters.js';
export { InputValidator } from './validator/InputValidator.js';
export { FieldValueValidator } from './validator/FieldValueValidator.js';
export { AdapterFieldValidator } from './validator/AdapterFieldValidator.js';
