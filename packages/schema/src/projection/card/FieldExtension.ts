import type { FougereFieldAxes } from '../../FougereFieldAxes.js';
import type { RoleDescriptor } from './RoleDescriptor.js';

/**
 * What each axis writes on a card — its declaration as it stands, except `role`, whose target
 * travels as a name. An axis registered from outside writes here too, under its own name.
 */
export type FieldExtension = {
  [Axis in keyof FougereFieldAxes]?: Axis extends 'role' ? RoleDescriptor : FougereFieldAxes[Axis];
} & { [axis: string]: unknown };
