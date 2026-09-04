/**
 * A name → value map: formats, generators, codecs, sources.
 *
 * The error is thrown here because this is where the known names are.
 */
export class Registry<T> {
  private readonly entries: Map<string, T>;

  /**
   * The error message, when a name is not registered:
   * `Unknown boundary decoder 'celsius' — call Boundaries.decoders.register(name, fn).`
   *          └─ kind ──────┘              └─ fix ───────────────────────────────────┘
   * `fix` is omitted where nothing calls `resolve` — `Formats`, `Boundaries.aliases`.
   */
  constructor(
    private readonly kind: string,
    private readonly fix?: string,
    builtins?: Iterable<readonly [string, T]>,
  ) {
    this.entries = new Map(builtins);
  }

  /**
   * Records a name, and hands the value back so the caller can keep it.
   * `const isSiret = Formats.register('siret', (v) => /^\d{14}$/.test(v))`
   */
  register(name: string, value: T): T {
    this.entries.set(name, value);

    return value;
  }

  /**
   * The value under a name, or `undefined`.
   * `Formats.find('email')` → `undefined` — the engine already judges that one
   */
  find(name: string): T | undefined {
    return this.entries.get(name);
  }

  /**
   * The value under a name. Throws when the name is not registered.
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
   * Whether a name is registered, without throwing.
   * FR : si un nom est enregistré, sans lever.
   * `Generators.answers('cuid2')` → `true`
   */
  answers(name: string): boolean {
    return this.entries.has(name);
  }

  /**
   * Every name registered.
   * `Sources.names` → `['sql', 'file']`
   */
  get names(): string[] {
    return [...this.entries.keys()];
  }
}
