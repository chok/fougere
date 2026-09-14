import type { EntityClass } from './EntityClass.js';
import type { PresenterInstance } from './PresenterInstance.js';
import type { SchemaView } from '@fougere/schema';
import type { RelationConfig } from './RelationConfig.js';

export interface TypeConfig {
  /** Nom du type GraphQL */
  name: string;
  /** The schema whose fields become the type — a live class, or a card that travelled. */
  entity: SchemaView;
  /** Champs à exclure du type GraphQL */
  exclude?: string[];
  /** Relations à résoudre */
  relations?: Record<string, RelationConfig>;
  /** Presenter instance — adds computed fields as resolveFields on this type. */
  presenter?: PresenterInstance;
  /** Presenter field names (methods to expose). If absent, all methods are exposed. */
  presenterFields?: string[];
  /** Per-field type metadata from source parsing. */
  presenterFieldMeta?: { name: string; returnType?: string; list?: boolean; nullable?: boolean }[];
  /**
   * The view a computed field emits, when the presenter declared one — the object type to build
   * for it.
   */
  presenterViews?: Record<string, EntityClass | [EntityClass]>;
  /** Builds (or reuses) the GraphQL object type for a declared view. */
  viewType?: (view: EntityClass, fieldName: string) => any;
}
