import type { SchemaView } from '@fougere/schema';
import type { OperationsMap } from '../wire/OperationsMap.js';

/** A discovered handler (controls what a service exposes). */
export interface HandlerEntry {
  /** Registration key (e.g. 'postHandler'). */
  name: string;
  /**
   * The name this handler answers to — its class name minus `Handler`, lowercased (`PostHandler` →
   * `post`).
   */
  address: string;
  /** The handler class. */
  ctor: new (...args: never[]) => unknown;
  /** All operations with full signatures for binding. */
  operations: OperationsMap;
  /** Constructor dependency type names (from AST scan). */
  deps: string[];
  /** Absolute file path (for debugging). */
  filePath: string;
  /** Whether this handler is part of the frond's public contract. */
  exposed?: boolean;
  /** Output schema override — when Crud(Entity, Output), restricts storage output. */
  outputOverride?: SchemaView;
  /** Surface name — subdirectory in handlers/ (e.g. 'admin', 'public'). */
  surface?: string;
}
