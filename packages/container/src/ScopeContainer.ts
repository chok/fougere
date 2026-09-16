import type { Container } from './Container.js';
import { Disposables, type Disposable } from './Disposable.js';
import { ContainerError } from './ContainerError.js';
import type { Constructor } from './registration/Constructor.js';
import type { Lifetime } from './registration/Lifetime.js';
import type { RegisterOptions } from './registration/RegisterOptions.js';

interface Entry {
  factory: (container: Container) => unknown;
  lifetime: Lifetime;
  instance?: unknown;
}

/** A scope reaches its parent and its children through members only a scope can read. */
export class ScopeContainer implements Container {
  private readonly built: (Disposable | AsyncDisposable)[] = [];
  private readonly children: ScopeContainer[] = [];
  private readonly registry = new Map<string, Entry>();
  private readonly resolving: string[];

  private fallback: ((name: string) => unknown) | undefined;

  constructor(private readonly parent?: ScopeContainer) {
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
    this.registry.set(name, {
      factory: () => value,
      lifetime: 'singleton',
      instance: value,
    });
  }

  resolve<T>(name: string): T {
    const entry = this.registry.get(name);

    if (!entry) {
      if (this.parent) return this.parent.resolve<T>(name);

      return this.buildFallback<T>(name);
    }

    if (entry.instance !== undefined) return entry.instance as T;

    return this.build<T>(name, entry);
  }

  has(name: string): boolean {
    return this.registry.has(name) || (this.parent?.has(name) ?? false);
  }

  createScope(): Container {
    const child = new ScopeContainer(this);

    this.children.push(child);

    return child;
  }

  async dispose(): Promise<void> {
    this.parent?.forget(this);

    const failures = await this.disposeChildren();

    failures.push(...(await this.disposeBuilt()));

    this.registry.clear();

    if (this.children.length > 0) {
      failures.push(
        new ContainerError(
          `${this.children.length} scope(s) still held after this one closed — probably opened while it was closing.`,
        ),
      );
    }

    if (failures.length > 0) {
      throw ContainerError.all(failures, 'one or more disposals failed');
    }
  }

  private async disposeChildren(): Promise<unknown[]> {
    const failures: unknown[] = [];

    while (this.children.length > 0) {
      const child = this.children[this.children.length - 1]!;

      try {
        await child.dispose();
      } catch (error) {
        failures.push(error);
      } finally {
        this.forget(child);
      }
    }

    return failures;
  }

  private async disposeBuilt(): Promise<unknown[]> {
    const failures: unknown[] = [];
    while (this.built.length > 0) {
      try {
        const value = this.built.pop();
        if (value) await Disposables.close(value);
      } catch (error) {
        failures.push(error);
      }
    }

    return failures;
  }

  setFallback(resolve: (name: string) => unknown): void {
    if (this.parent) return this.parent.setFallback(resolve);

    this.fallback = resolve;
  }

  private build<T>(name: string, entry: Entry): T {
    if (this.resolving.includes(name)) {
      throw new ContainerError(
        `dependency cycle: ${[...this.resolving, name].join(' → ')}`,
      );
    }

    this.resolving.push(name);

    try {
      const value = entry.factory(this) as T;

      if (entry.lifetime === 'singleton') {
        entry.instance = value;

        this.remember(value);
      }

      return value;
    } finally {
      this.resolving.pop();
    }
  }

  private buildFallback<T>(name: string): T {
    const made = this.fallback?.(name);
    if (made === undefined) throw new ContainerError(this.errorMessage(name));

    this.registry.set(name, {
      factory: () => made,
      lifetime: 'singleton',
      instance: made,
    });

    return made as T;
  }

  private forget(child: ScopeContainer): void {
    const at = this.children.indexOf(child);

    if (at !== -1) this.children.splice(at, 1);
  }

  /** What this scope will close. A value that answers no `dispose` is not one of them. */
  private remember(value: unknown): void {
    if (Disposables.is(value)) this.built.push(value);
  }

  private errorMessage(name: string): string {
    const path =
      this.resolving.length > 0
        ? ` (resolving: ${[...this.resolving, name].join(' → ')})`
        : '';

    return `'${name}' is not registered${path}`;
  }
}
