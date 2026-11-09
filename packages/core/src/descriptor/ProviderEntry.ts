import type { Subject } from './Subject.js';
import type { DeclaredAnswer } from './DeclaredAnswer.js';
import type { CollectorEntry } from './CollectorEntry.js';
/** A class of `services/`, injected by type. */
export interface ProviderEntry extends Subject, Pick<CollectorEntry, 'refuses' | 'collecting'> {
  /** The container key, as the source spells the class name. */
  name?: string;
  /** The class is `abstract`: a port, never a candidate to realize one. */
  abstract?: true;
  /** The ports it implements; with the port among its `deps`, it is a link. */
  implements?: string[];
  /** What a link at a handler's door may answer in an op's place, by op. */
  answers?: Record<string, DeclaredAnswer[]>;
}
