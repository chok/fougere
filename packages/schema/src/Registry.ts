/**
 * A name → value map, one per kind: formats, generators, adapters, sources, codecs.
 *
 * It refuses an unknown name itself, being the only place that can list the known ones.
 */
export class Registry<T> {
  private readonly entries: Map<string, T>;

  /**
   * `kind` is the word a refusal uses, `remedy` the call it points at.
   * FR : `kind` est le mot qu'emploie un refus, `remedy` l'appel qu'il désigne.
   * `new Registry<Decoder>('boundary decoder', 'call Boundaries.decoders.register(name, fn)')`
   */
  constructor(
    private readonly kind: string,
    private readonly remedy: string,
    builtins?: Iterable<readonly [string, T]>,
  ) {
    this.entries = new Map(builtins);
  }

  /**
   * Records a name, and hands the value back so the caller can keep it.
   * FR : enregistre un nom, et rend la valeur pour que l'appelant la garde.
   * `export const sqlEntries = Adapters.register('sql', EntryJudge.of(FORMAT))`
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
   * The value under a name, refusing when nothing is registered. `at` says where the name was read.
   * FR : la valeur sous un nom, refusée s'il n'y a rien. `at` dit où le nom a été lu.
   * `Generators.resolve('ulid')`
   * → throws `Unknown generator 'ulid' — call Generators.register(name, fn). This process answers cuid2, uuid, nanoid.`
   */
  resolve(name: string, at?: string): T {
    const found = this.entries.get(name);

    if (found !== undefined) return found;

    throw new Error(
      `${at ? `${at}: ` : ''}Unknown ${this.kind} '${name}' — ${this.remedy}. `
      + `This process answers ${this.names.join(', ') || 'nothing yet'}.`,
    );
  }

  /**
   * Whether a name is registered, for a caller that must not throw to find out.
   * FR : si un nom est enregistré, pour un appelant qui ne doit pas lever pour le savoir.
   * `Generators.answers('cuid2')` → `true`
   */
  answers(name: string): boolean {
    return this.entries.has(name);
  }

  /**
   * Every name registered.
   * FR : tous les noms enregistrés.
   * `Adapters.names` → `['sql']`
   */
  get names(): string[] {
    return [...this.entries.keys()];
  }
}
