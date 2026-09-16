/** A discovered provider — a class under `services/` or `repositories/`, injected by type. */
export interface ProviderEntry {
  /**
   * The container key — the class name as the SOURCE spells it.
   *
   * Read at boot off `ctor.name` for a decade of no consequence, until a bundler lowered
   * a `static readonly` field and renamed the declaration doing it: the provider
   * registered as `_Communes` and the handler asking for `Communes` got a container miss.
   * A name a tool may rewrite is written down, for the same reason `deps` is.
   */
  name?: string;
  /** The class constructor (default export of the file). */
  ctor: new (...args: never[]) => unknown;
  /** Constructor dependency type names (from AST scan). */
  deps: string[];
  /** Absolute file path (for debugging). */
  filePath: string;
  /**
   * It stated `implements AsyncDisposable` — so there is ONE of it per frond, and that frond's
   * scope closes it. The language's own marker, which `App` already answers; a provider that
   * says nothing is built per consumer and closed by nobody, which is right for one that holds
   * nothing.
   */
  kept?: true;
}
