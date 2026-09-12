import type { Container, RegisterOptions, Constructor, Disposable } from './container.js';

interface Entry {
  factory: (container: Container) => unknown;
  lifetime: 'singleton' | 'transient';
  instance?: unknown;
}

const isDisposable = (value: unknown): value is Disposable =>
  typeof value === 'object' && value !== null &&
  typeof (value as Disposable).dispose === 'function';

/** A scope reaches its parent and its children through members only a scope can read. */
class Scope implements Container {
  private readonly registry = new Map<string, Entry>();
  // In construction order: a thing built later may hold one built earlier, so disposal
  // walks this backwards.
  private readonly built: unknown[] = [];
  // Closed by this container, and before `built` — a child may hold what this scope built,
  // never the other way round.
  private readonly children: Scope[] = [];
  private fallback: ((name: string) => unknown) | undefined;
  // The names being built right now, shared by the whole tree: a miss here is answered by the
  // parent and the descent continues there, so only one stack can name the path whole —
  // `child.resolve('A')` reaching a parent's `B` that asks for `A` back reports `A → B → A`.
  private readonly resolving: string[];

  constructor(private readonly parent?: Scope) {
    this.resolving = parent?.resolving ?? [];
  }

  register<T>(name: string, ctor: Constructor<T>, options?: RegisterOptions): void {
    const lifetime = options?.lifetime ?? 'transient';
    const deps = options?.deps ?? [];
    this.registry.set(name, {
      factory: (c) => new ctor(...deps.map((d) => c.resolve(d))),
      lifetime,
    });
  }

  registerValue<T>(name: string, value: T): void {
    // A value the container did not build is not the container's to dispose.
    this.registry.set(name, { factory: () => value, lifetime: 'singleton', instance: value });
  }

  resolve<T>(name: string): T {
    const entry = this.registry.get(name);

    // Not found locally — the parent holds it, and holds its instance too.
    if (!entry && this.parent?.entryOf(name)) {
      return this.parent.resolve<T>(name);
    }

    // Nobody holds it. A frond declared in `remotes` registers nothing here, so its
    // façade is fabricated by the fallback rather than found.
    if (!entry) {
      const made = this.fallbackOf()?.(name);
      if (made !== undefined) {
        this.registry.set(name, { factory: () => made, lifetime: 'singleton', instance: made });

        return made as T;
      }
      throw new Error(`[container] '${name}' is not registered${this.through(name)}`);
    }

    if (entry.instance !== undefined) return entry.instance as T;

    if (this.resolving.includes(name)) {
      throw new Error(`[container] dependency cycle: ${[...this.resolving, name].join(' → ')}`);
    }

    // Popped in a finally, because a constructor that throws leaves the name on the stack
    // otherwise and the next resolution of it reports a cycle that is not there.
    this.resolving.push(name);
    try {
      const value = entry.factory(this) as T;
      // The container disposes what it KEEPS: a transient is handed over and forgotten,
      // and its caller is the one who knows when it is done.
      if (entry.lifetime === 'singleton') {
        entry.instance = value;
        this.remember(value);
      }

      return value;
    } finally {
      this.resolving.pop();
    }
  }

  has(name: string): boolean {
    return this.registry.has(name) || (this.parent?.has(name) ?? false);
  }

  createScope(): Container {
    const child = new Scope(this);
    this.children.push(child);

    return child;
  }

  async dispose(): Promise<void> {
    // Everything is told before anything throws, then the failures travel together.
    // Dropped from the parent first: a scope that closes itself leaves a reference the
    // parent would hold for the life of the process.
    this.parent?.forget(this);
    const failures: unknown[] = [];
    // A copy: closing a child splices it out of `children`, so walking the array
    // itself stepped over every second sibling.
    for (const child of [...this.children].reverse()) {
      try {
        await child.dispose();
      } catch (error) {
        failures.push(error);
      }
    }
    this.children.length = 0;
    for (const value of this.built.reverse()) {
      try {
        await (value as Disposable).dispose();
      } catch (error) {
        failures.push(error);
      }
    }
    this.built.length = 0;
    this.registry.clear();
    if (failures.length > 0) {
      throw new AggregateError(failures, '[container] one or more disposals failed');
    }
  }

  setFallback(resolve: (name: string) => unknown): void {
    this.fallback = resolve;
  }

  private entryOf(name: string): Entry | undefined {
    return this.registry.get(name) ?? this.parent?.entryOf(name);
  }

  /** Set on the root, honoured from any scope — a scope inherits it by asking upward. */
  private fallbackOf(): ((name: string) => unknown) | undefined {
    return this.fallback ?? this.parent?.fallbackOf();
  }

  private forget(child: Scope): void {
    const at = this.children.indexOf(child);
    if (at !== -1) this.children.splice(at, 1);
  }

  private through(name: string): string {
    return this.resolving.length > 0 ? ` (resolving: ${[...this.resolving, name].join(' → ')})` : '';
  }

  private remember<T>(value: T): T {
    if (isDisposable(value)) this.built.push(value);

    return value;
  }
}

export function createContainer(): Container {
  return new Scope();
}
