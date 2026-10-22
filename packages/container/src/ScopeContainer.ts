import type { Container } from './Container.js';
import { ContainerError } from './ContainerError.js';
import type { Constructor } from './registration/Constructor.js';
import type { Lifetime } from './registration/Lifetime.js';
import type { RegisterOptions } from './registration/RegisterOptions.js';

interface Entry {
  factory: (container: Container) => unknown;
  lifetime: Lifetime;
  dependencies: readonly string[];
  instance?: unknown;
}

/** A scope reaches its parent and its children through members only a scope can read. */
export class ScopeContainer implements Container {
  private readonly toDispose: (AsyncDisposable | Disposable)[] = [];
  private readonly children: ScopeContainer[] = [];
  private readonly registry = new Map<string, Entry>();
  private readonly resolving: string[];

  private fallback: ((name: string) => unknown) | undefined;

  constructor(private readonly parent?: ScopeContainer) {
    this.resolving = parent?.resolving ?? [];
  }

  register<T>(name: string, ctor: Constructor<T>, options?: RegisterOptions): void {
    this.addEntry(name, ScopeContainer.entryOfClass(ctor, options));
  }

  registerValue<T>(name: string, value: T): void {
    this.addEntry(name, ScopeContainer.entryOfValue(value));
  }

  replace<T>(name: string, ctor: Constructor<T>, options?: RegisterOptions): void {
    this.replaceEntry(name, ScopeContainer.entryOfClass(ctor, options));
  }

  replaceValue<T>(name: string, value: T): void {
    this.replaceEntry(name, ScopeContainer.entryOfValue(value));
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

  dependencies(): ReadonlyMap<string, readonly string[]> {
    return new Map([...this.registry].map(([name, entry]) => [name, entry.dependencies]));
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
    this.parent?.removeChild(this);

    const failures = await this.disposeChildren();

    failures.push(...(await this.disposeInstances()));

    this.registry.clear();

    if (this.children.length > 0) {
      failures.push(
        new ContainerError(
          `${this.children.length} scope(s) still held after this one closed — probably opened while it was closing.`,
        ),
      );
    }

    if (failures.length > 0) {
      throw new AggregateError(failures, 'one or more disposals failed');
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
        this.removeChild(child);
      }
    }

    return failures;
  }

  private async disposeInstances(): Promise<unknown[]> {
    const failures: unknown[] = [];
    while (this.toDispose.length > 0) {
      try {
        await ScopeContainer.close(this.toDispose.pop()!);
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

        this.disposeLater(value);
      }

      return value;
    } finally {
      this.resolving.pop();
    }
  }

  private buildFallback<T>(name: string): T {
    const value = this.fallback?.(name);

    if (value === undefined) throw new ContainerError(this.errorMessage(name));

    this.registerValue(name, value);

    return value as T;
  }

  private addEntry(name: string, entry: Entry): void {
    if (this.registry.has(name)) {
      throw new ContainerError(
        `'${name}' is already registered in this scope. Use replace() to replace it.`,
      );
    }

    this.registry.set(name, entry);
  }

  private replaceEntry(name: string, entry: Entry): void {
    if (!this.has(name)) {
      throw new ContainerError(`'${name}' is not registered, so it cannot be replaced. Use register().`);
    }

    this.registry.set(name, entry);
  }

  private removeChild(child: ScopeContainer): void {
    const at = this.children.indexOf(child);

    if (at !== -1) this.children.splice(at, 1);
  }

  /** What this scope will close. A value that answers neither `[Symbol.asyncDispose]` nor `[Symbol.dispose]` is not one of them. */
  private disposeLater(value: unknown): void {
    if (ScopeContainer.isDisposable(value)) this.toDispose.push(value);
  }

  private static entryOfClass<T>(ctor: Constructor<T>, options?: RegisterOptions): Entry {
    const deps = options?.deps ?? [];

    return {
      factory: (c) => new ctor(...deps.map((d) => c.resolve(d))),
      lifetime: options?.lifetime ?? 'transient',
      dependencies: deps,
    };
  }

  private static entryOfValue(value: unknown): Entry {
    return { factory: () => value, lifetime: 'singleton', dependencies: [], instance: value };
  }

  private static isDisposable(value: unknown): value is AsyncDisposable | Disposable {
    return typeof value === 'object' && value !== null
      && (typeof (value as AsyncDisposable)[Symbol.asyncDispose] === 'function'
        || typeof (value as Disposable)[Symbol.dispose] === 'function');
  }

  private static async close(value: AsyncDisposable | Disposable): Promise<void> {
    if (Symbol.asyncDispose in value) return value[Symbol.asyncDispose]();

    value[Symbol.dispose]();
  }

  private errorMessage(name: string): string {
    const path =
      this.resolving.length > 0
        ? ` (resolving: ${[...this.resolving, name].join(' → ')})`
        : '';

    return `'${name}' is not registered${path}`;
  }
}
