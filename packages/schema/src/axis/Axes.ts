import { Registry } from '../lib/Registry.js';
import type { JsonSchema } from '../lib/JsonSchema.js';
import { fieldFormat } from '../field/FieldFormat.js';
import type { Axis } from './Axis.js';
import { Boundary } from './boundary/Boundary.js';
import { Lifecycle } from './lifecycle/Lifecycle.js';
import { Role } from './role/Role.js';

class AxisRegistry extends Registry<Axis> {
  private composed?: JsonSchema;

  register(slot: string, axis: Axis): Axis {
    this.composed = undefined;

    return super.register(slot, axis);
  }

  /** The document a field declaration is judged against, rebuilt the next time one arrives. */
  get fieldFormat(): JsonSchema {
    this.composed ??= fieldFormat(this.entries);

    return this.composed;
  }
}

/**
 * The axes this process reads, and the door an axis declared elsewhere comes through.
 * `Axes.register('tenancy', Tenancy)` — from a `vocabulary/` file, read before `entities/`
 */
export const Axes = new AxisRegistry('axis', 'call Axes.register(slot, axis)', [
  ['role', Role],
  ['lifecycle', Lifecycle],
  ['boundary', Boundary],
]);
