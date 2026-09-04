export class Registry<T> {
  private readonly entries: Map<string, T>;

  /** `Unknown boundary decoder 'celsius' — call Boundaries.decoders.register(name, fn).` */
  constructor(
    private readonly label: string,
    private readonly hint?: string,
    builtins?: Iterable<readonly [string, T]>,
  ) {
    this.entries = new Map(builtins);
  }

  register(name: string, value: T): T {
    this.entries.set(name, value);

    return value;
  }

  find(name: string): T | undefined {
    return this.entries.get(name);
  }

  resolve(name: string, path?: string): T {
    const found = this.find(name);

    if (found !== undefined) return found;

    throw new Error(
      `${path ? `${path}: ` : ''}Unknown ${this.label} '${name}'${this.hint ? ` — ${this.hint}` : ''}. ` +
        `This process answers ${this.names.join(', ') || 'nothing yet'}.`,
    );
  }

  private get names(): string[] {
    return [...this.entries.keys()];
  }
}
