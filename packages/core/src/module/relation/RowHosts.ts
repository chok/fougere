import type { Graph } from '@fougere/graph';
import type { SchemaView } from '@fougere/schema';
import type { Constraint } from '../../extension/Constraint.js';
import type { Marks } from './Marks.js';
import type { Peer } from './Peer.js';
import type { Journal } from '../../wire/Journal.js';
import type { Storage } from '../../storage/Storage.js';

/**
 * Where an entity's rows are hosted, and what the host keeps — what a `ref()` asks the boot.
 *
 * Documented: [entities](https://fougere.dev/docs/concepts/entity).
 */
export interface RowHosts {
  /** False behind `remotes:`. */
  hostedHere(entity: string): boolean;
  /** The source `sources:` puts an entity's rows in — whichever process serves its frond. */
  sourceOf(entity: string): string | undefined;
  /** How a source keeps its marks, absent where this process cannot reach its rows by its name. */
  marksIn(source: string): Marks | undefined;
  enforces(source: string, constraint: Constraint): boolean;
  /** Resolved through the frond that owns the entity, since a scope sees its parent and not its siblings. */
  storageOf(entity: string): Storage | undefined;
  /** Every entity of every frond — a row is named from wherever its namer was declared. */
  entities(): ReadonlyMap<string, SchemaView>;
  /** Every `ref()` among those entities, from the namer to the named, labelled by its field. */
  relations(): Graph;
  /** The process that HOLDS an entity's rows, when this one does not. */
  peerOf(entity: string): Peer | undefined;
  /** One per declared remote, whatever this process knows of what lives there. */
  peers(): readonly Peer[];
  /** The journal a package registered, resolved per call — absent for what CARRIES one. */
  journal(entity: string): Journal | undefined;
}
