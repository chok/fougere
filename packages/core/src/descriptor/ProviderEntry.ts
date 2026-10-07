import type { Subject } from './Subject.js';
/** A discovered provider — a class under `services/` or `repositories/`, injected by type. */
export interface ProviderEntry extends Subject {
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
}
