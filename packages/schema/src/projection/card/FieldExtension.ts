import type { FougereFieldAxes } from '../../FougereFieldAxes.js';
import type { RoleDescriptor } from './RoleDescriptor.js';

/** What each axis writes on a card, under its own name. */
export type FieldExtension = {
  [Axis in keyof FougereFieldAxes]?: Axis extends 'role' ? RoleDescriptor : FougereFieldAxes[Axis];
} & { [axis: string]: unknown };
