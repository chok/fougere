import type { BindingPlan } from '@fougere/core/descriptor';
import type { SchemaView } from '@fougere/schema';

export interface OperationMeta {
  input?: SchemaView;
  output?: SchemaView;
  /** Canonical kind from core's EffectiveOperation. */
  kind: 'query' | 'command';
  /** Where each argument is read from — what the path is derived from. */
  binding?: BindingPlan;
  /** The operation in words — see `RouteDefinition.description`. */
  description?: string;
}
