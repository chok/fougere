import type { SchemaView } from '@fougere/schema';

export interface OperationMeta {
  input?: SchemaView;
  output?: SchemaView;
  /** Canonical kind from core's EffectiveOperation. */
  kind: 'query' | 'command';
  /** The operation in words — see `RouteDefinition.description`. */
  description?: string;
}
