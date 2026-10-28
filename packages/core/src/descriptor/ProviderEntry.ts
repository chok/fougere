import type { Subject } from './Subject.js';
import type { DeclaredAnswer } from './DeclaredAnswer.js';
import type { CollectorEntry } from './CollectorEntry.js';
/**
 * A discovered provider — a class under `services/`, injected by type. A link in front of
 * `Collect<User>` carries the collector's `refuses` and `collecting`, since it stands in for both methods.
 */
export interface ProviderEntry extends Subject, Pick<CollectorEntry, 'refuses' | 'collecting'> {
  /**
   * The container key — the class name as the SOURCE spells it.
   *
   * Read at boot off `ctor.name` for a decade of no consequence, until a bundler lowered
   * a `static readonly` field and renamed the declaration doing it: the provider
   * registered as `_Communes` and the handler asking for `Communes` got a container miss.
   * A name a tool may rewrite is written down, for the same reason `deps` is.
   */
  name?: string;
  /**
   * What the source said and the runtime erased: a port, which a class below answers for and
   * nothing may instantiate — never a candidate for the ports above it.
   */
  abstract?: true;
  /**
   * The ports it says it stands in front of — `implements Partial<Payment>` — erased at runtime like
   * `abstract`, so only the source can say it. With the port among its `deps`, it is a link.
   */
  implements?: string[];
  /**
   * What a link at a door bound to a handler — `Rest<PostHandler>` — may answer in an op's place, by op,
   * published on the op's contract at that door. The scan reads it off the return types; a `frond()`
   * states it.
   */
  answers?: Record<string, DeclaredAnswer[]>;
}
