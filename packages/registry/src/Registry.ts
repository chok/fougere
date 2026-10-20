import { RegistryError } from './RegistryError.js';
import { Term } from './Term.js';

/** What a reload replaced — told to whoever reloaded, since this package holds no logger. */
export type Replaced = (registry: string, name: string) => void;

/**
 * A question a package opens — `which source type is 'sqlite'?`, `which generator is 'ulid'?` — and
 * the one answer each name has. A name answered twice is refused naming the registry, unless the same
 * answer comes back or `replace` says standing in its place is the point.
 *
 * A host that re-reads a project in the same process — `fougere dev` — re-runs the files
 * that answer, and says so: inside `Registry.reloading`, an answer replaces the one it had.
 * The packages it does not re-run keep theirs, so nothing is lost and nothing is noted.
 */
export class Registry<T> {
  private static replaced: Replaced | undefined;

  /** Every registry this process made — what a report of the extension points reads. */
  private static readonly made = new Set<Registry<unknown>>();

  private readonly held: Map<string, T>;

  constructor(
    readonly label: string,
    private readonly hint?: string,
    entries?: Iterable<readonly [string, T]>,
  ) {
    this.held = new Map(entries);
    Registry.made.add(this as Registry<unknown>);
  }

  /** Every registry this process made, each by its label and the names it answers. */
  static every(): { label: string; names: string[] }[] {
    return [...Registry.made].map((one) => ({ label: one.label, names: one.names }));
  }

  /** Runs `reload`, during which a second answer under a name replaces the first. */
  static async reloading<R>(reload: () => Promise<R>, replaced: Replaced = () => {}): Promise<R> {
    const outer = Registry.replaced;
    Registry.replaced = replaced;
    try {
      return await reload();
    } finally {
      Registry.replaced = outer;
    }
  }

  register(name: string, value: T): T {
    const held = this.held.get(name);
    if (held !== undefined && held !== value) {
      const replaced = Registry.replaced;
      if (!replaced) {
        throw new RegistryError(
          `Two ${this.label}s are named '${name}'. Rename one, or use replace() to replace the first.`,
        );
      }
      replaced(this.label, name);
    }

    this.held.set(name, value);

    return value;
  }

  /** The answer as a value — exported from `vocabulary/`, registered by the frond that states it. */
  term(name: string, value: T): Term<T> {
    return new Term(this, name, value);
  }

  replace(name: string, value: T): T {
    if (!this.held.has(name)) {
      throw new RegistryError(`No ${this.label} is named '${name}', so it cannot be replaced. Use register().`);
    }

    this.held.set(name, value);

    return value;
  }

  find(name: string): T | undefined {
    return this.held.get(name);
  }

  resolve(name: string, path?: string): T {
    const found = this.find(name);

    if (found !== undefined) return found;

    throw new RegistryError(
      `${path ? `${path}: ` : ''}Unknown ${this.label} '${name}'. Known: ${this.names.join(', ') || 'none'}.`
        + `${this.hint ? ` To add one, ${this.hint}.` : ''}`,
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
