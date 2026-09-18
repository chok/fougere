import type { BoundaryRef } from '../../axis/boundary/Boundary.js';
import type { LifecycleRules } from '../../axis/lifecycle/Lifecycle.js';
import type { RoleDescriptor } from './RoleDescriptor.js';

export interface FieldExtension {
  role?: RoleDescriptor;
  lifecycle?: LifecycleRules;
  boundary?: BoundaryRef;

  /** An axis registered from outside writes its own slot here, under its own name. */
  [slot: string]: unknown;
}
