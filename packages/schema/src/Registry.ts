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
   * FR : le message d'erreur quand un nom n'est pas enregistré.
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
   * FR : enregistre un nom, et rend la valeur pour que l'appelant la garde.
   * `const isSiret = Formats.register('siret', (v) => /^\d{14}$/.test(v))`
   */
  register(name: string, value: T): T {
    this.entries.set(name, value);

    return value;
  }

  /**
   * The value under a name, or `undefined`.
   * FR : la valeur sous un nom, ou `undefined`.
   * `Formats.find('email')` → `undefined` — the engine already judges that one
   */
  find(name: string): T | undefined {
    return this.entries.get(name);
  }

  /**
   * The value under a name. Throws when the name is not registered; `at` prefixes the message.
   * FR : la valeur sous un nom. Lève si le nom n'est pas enregistré ; `at` préfixe le message.
   * `Generators.resolve('ulid')`
   * → throws `Unknown generator 'ulid' — call Generators.register(name, fn). This process answers cuid2, uuid, nanoid.`
   */
  resolve(name: string, at?: string): T {
    const found = this.entries.get(name);

    if (found !== undefined) return found;

    throw new Error(
      `${at ? `${at}: ` : ''}Unknown ${this.kind} '${name}'${this.fix ? ` — ${this.fix}` : ''}. `
      + `This process answers ${this.names.join(', ') || 'nothing yet'}.`,
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
   * FR : tous les noms enregistrés.
   * `Sources.names` → `['sql', 'file']`
   */
  get names(): string[] {
    return [...this.entries.keys()];
  }
}
