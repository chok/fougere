/**
 * A name → value map: Formats, Generators, Boundaries.decoders, Boundaries.encoders,
 * Boundaries.aliases, Sources. The error is thrown here because the known names are here.
 */
export class Registry<T> {
  private readonly entries: Map<string, T>;

  /**
   * The error message, when a name is not registered:
   * `Unknown boundary decoder 'celsius' — call Boundaries.decoders.register(name, fn).`
   *          └─ kind ──────┘              └─ fix ───────────────────────────────────┘
   * `fix` is omitted where nothing calls `resolve` — Formats, Boundaries.aliases.
   */
  constructor(
    private readonly kind: string,
    private readonly fix?: string,
    builtins?: Iterable<readonly [string, T]>,
  ) {
    this.entries = new Map(builtins);
  }

  /**
   * Use `register` to teach this process a name an entity or a config can then write.
   * A second call under the same name replaces the first.
   * `const isSiret = Formats.register('siret', (v) => /^\d{14}$/.test(v))` → `format: 'siret'` uses `isSiret`
   */
  register(name: string, value: T): T {
    this.entries.set(name, value);

    return value;
  }

  /**
   * Use `find` for optional Formats and Boundaries.aliases lookups; use `resolve` when
   * an unknown configured name must stop processing.
   * `Formats.find('email')` → `undefined`, and `ValueJudge` moves on
   */
  find(name: string): T | undefined {
    return this.entries.get(name);
  }

  /**
   * Use `resolve` with Generators, Boundaries.decoders, Boundaries.encoders, or Sources;
   * use `find` for optional Formats and Boundaries.aliases lookups.
   * `Generators.resolve('ulid')`
   * → `Unknown generator 'ulid' — call Generators.register(name, fn). This process answers cuid2, uuid, nanoid.`
   * `Sources.resolve('file', 'archive.source')`
   * → `archive.source: Unknown source 'file' — import the adapter that answers it, … answers sql.`
   */
  resolve(name: string, path?: string): T {
    const found = this.find(name);

    if (found !== undefined) return found;

    throw new Error(
      `${path ? `${path}: ` : ''}Unknown ${this.kind} '${name}'${this.fix ? ` — ${this.fix}` : ''}. ` +
        `This process answers ${this.names.join(', ') || 'nothing yet'}.`,
    );
  }

  /**
   * Use `answers` for feature detection without loading the registered value; use `find`
   * when the next step needs that value.
   * `Generators.answers('cuid2')` → `true`
   */
  answers(name: string): boolean {
    return this.entries.has(name);
  }

  /**
   * Use `names` to show the choices imported into this process; use `answers` to test one.
   * `Sources.names` → `['sql', 'file']`
   */
  get names(): string[] {
    return [...this.entries.keys()];
  }
}
