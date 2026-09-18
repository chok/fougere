import { SchemaError } from '../SchemaError.js';

export class Registry<T> {
  private readonly held: Map<string, T>;

  constructor(
    private readonly label: string,
    private readonly hint?: string,
    entries?: Iterable<readonly [string, T]>,
  ) {
    this.held = new Map(entries);
  }

  register(name: string, value: T): T {
    this.held.set(name, value);

    return value;
  }

  find(name: string): T | undefined {
    return this.held.get(name);
  }

  resolve(name: string, path?: string): T {
    const found = this.find(name);

    if (found !== undefined) return found;

    throw new SchemaError(
      `${path ? `${path}: ` : ''}Unknown ${this.label} '${name}'${this.hint ? ` — ${this.hint}` : ''}. ` +
        `This process answers ${this.names.join(', ') || 'nothing yet'}.`,
    );
  }

  get names(): string[] {
    return [...this.held.keys()];
  }

  get entries(): [string, T][] {
    return [...this.held];
  }

  get all(): T[] {
    return [...this.held.values()];
  }
}
