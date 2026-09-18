import { Registry } from '../lib/Registry.js';
import type { JsonSchema } from '../lib/JsonSchema.js';
import { fieldFormat } from '../field/FieldFormat.js';
import type { Axis } from './Axis.js';
import { boundaryAxis } from './boundary/Boundary.js';
import { lifecycleAxis } from './lifecycle/Lifecycle.js';
import { roleAxis } from './role/Role.js';

class AxisRegistry extends Registry<Axis> {
  private composed?: JsonSchema;

  register(slot: string, axis: Axis): Axis {
    this.composed = undefined;

    return super.register(slot, axis);
  }

  /** The document a field declaration is judged against, rebuilt the next time one arrives. */
  get fieldFormat(): JsonSchema {
    this.composed ??= fieldFormat(this.all);

    return this.composed;
  }
}

/**
 * The axes this process reads, and the door an axis declared elsewhere comes through.
 * FR : les axes que ce process lit, et la porte par où un axe déclaré ailleurs entre.
 * `Axes.register('tenancy', tenancyAxis)` — from a `vocabulary/` file, read before `entities/`
 */
export const Axes = new AxisRegistry('axis', 'call Axes.register(slot, axis)', [
  [roleAxis.slot, roleAxis],
  [lifecycleAxis.slot, lifecycleAxis],
  [boundaryAxis.slot, boundaryAxis],
]);
