import type { SchemaView } from '@fougere/schema';
import type { Constraint } from '../Constraint.js';
import type { Peer } from './Peer.js';
import type { Journal } from '../dispatch/Journal.js';
import type { Storage } from '../storage/Storage.js';

/**
 * Where an entity's rows are hosted, and what the host keeps — what a `ref()` asks the boot.
 *
 * Documented: [entities](https://fougere.dev/docs/schema/entities).
 */
export interface Hosting {
  /** False behind `remotes:` — whose `sourceOf` still answers the default, and means nothing. */
  hostedHere(entity: string): boolean;
  sourceOf(entity: string): string;
  enforces(source: string, constraint: Constraint): boolean;
  /**
   * Resolved through the frond that owns it, never the asking frond's scope: a scope sees its
   * parent and not its siblings, so a target of another frond was answered by nothing.
   */
  storageOf(entity: string): Storage | undefined;
  /** Every entity of every frond — a row is named from wherever its namer was declared. */
  entities(): ReadonlyMap<string, SchemaView>;
  /**
   * The process that HOLDS an entity's rows, when this one does not. Absent when nothing can
   * reach it: no `remotes:` entry, or no transport to carry the ask.
   */
  peerOf(entity: string): Peer | undefined;
  /**
   * One per declared remote, whatever this process knows of what lives there.
   *
   * A frond behind `remotes:` may have no sources here at all — `fougere sync` writes a card
   * and nothing else — so this process cannot see that its rows name ours. Only the process
   * holding them can, which is why a release asks every remote rather than deciding for it.
   */
  peers(): readonly Peer[];
  /** The journal a package registered, resolved per call — absent for what CARRIES one. */
  journal(entity: string): Journal | undefined;
}
