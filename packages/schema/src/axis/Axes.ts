import { Registry } from '@fougere/registry';
import type { JsonSchema } from '../lib/JsonSchema.js';
import { Format } from '../lib/Format.js';
import { SHAPE_FORMAT } from './shape/ShapeFormat.js';
import type { Axis } from './Axis.js';
import { Boundary } from './boundary/Boundary.js';
import { Lifecycle } from './lifecycle/Lifecycle.js';
import { Role } from './role/Role.js';

class AxisRegistry extends Registry<Axis> {
  private composed?: JsonSchema;

  register(name: string, axis: Axis): Axis {
    this.composed = undefined;

    return super.register(name, axis);
  }

  /** The document a field declaration is judged against, rebuilt the next time one arrives. */
  get fieldFormat(): JsonSchema {
    this.composed ??= this.entries
      .reduce((held, [name, axis]) => held.cites(name, axis.format), Format.of('field').cites('shape', SHAPE_FORMAT))
      .closed().schema as JsonSchema;

    return this.composed;
  }
}

/**
 * The axes this process reads, and the door an axis declared elsewhere comes through.
 * `Axes.register('tenancy', Tenancy)` — from a `vocabulary/` file, read before `entities/`
 */
export const Axes = new AxisRegistry('axis', 'call Axes.register(name, axis)', [
  ['role', Role],
  ['lifecycle', Lifecycle],
  ['boundary', Boundary],
]);
