import type { BoundaryRef } from '../../axis/boundary/BoundaryRef.js';
import type { LifecycleRules } from '../../axis/lifecycle/LifecycleRules.js';
import type { RoleDescriptor } from './RoleDescriptor.js';

export interface FieldExtension {
  role?: RoleDescriptor;
  lifecycle?: LifecycleRules;
  boundary?: BoundaryRef;
}
