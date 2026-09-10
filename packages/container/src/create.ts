import type { Container, RegisterOptions, Constructor, Disposable } from './container.js';

interface Entry {
  factory: (container: Container) => unknown;
  lifetime: 'singleton' | 'transient';
  instance?: unknown;
}

interface ScopeContainer extends Container {
  _getEntry(name: string): Entry | undefined;
  _getFallback(): ((name: string) => unknown) | undefined;
  _forget(child: ScopeContainer): void;
}

const isDisposable = (value: unknown): value is Disposable =>
  typeof value === 'object' && value !== null &&
  typeof (value as Disposable).dispose === 'function';

function createScope(parent?: ScopeContainer): ScopeContainer {
  const registry = new Map<string, Entry>();
  // In construction order: a thing built later may hold one built earlier, so disposal
  // walks this backwards.
  const built: unknown[] = [];
  // Closed by this container, and before `built` — a child may hold what this scope built,
  // never the other way round.
  const children: ScopeContainer[] = [];
  let fallback: ((name: string) => unknown) | undefined;

  const remember = <T>(value: T): T => {
    if (isDisposable(value)) built.push(value);
    return value;
  };

  const container: ScopeContainer = {
    register<T>(name: string, ctor: Constructor<T>, options?: RegisterOptions) {
      const lifetime = options?.lifetime ?? 'transient';
      const deps = options?.deps ?? [];
      registry.set(name, {
        factory: (c) => new ctor(...deps.map((d) => c.resolve(d))),
        lifetime,
      });
    },

    registerValue<T>(name: string, value: T) {
      // A value the container did not build is not the container's to dispose.
      registry.set(name, { factory: () => value, lifetime: 'singleton', instance: value });
    },

    resolve<T>(name: string): T {
      let entry = registry.get(name);

      // Not found locally — the parent holds it, and holds its instance too.
      if (!entry && parent && parent._getEntry(name)) {
        return parent.resolve<T>(name);
      }

      // Nobody holds it. A frond declared in `remotes` registers nothing here, so its
      // façade is fabricated by the fallback rather than found.
      if (!entry) {
        const made = container._getFallback()?.(name);
        if (made !== undefined) {
          registry.set(name, { factory: () => made, lifetime: 'singleton', instance: made });
          return made as T;
        }
        throw new Error(`[container] '${name}' is not registered`);
      }

      if (entry.instance !== undefined) return entry.instance as T;
      const value = entry.factory(container) as T;
      // The container disposes what it KEEPS: a transient is handed over and forgotten,
      // and its caller is the one who knows when it is done.
      if (entry.lifetime === 'singleton') {
        entry.instance = value;
        remember(value);
      }
      return value;
    },

    has(name: string): boolean {
      return registry.has(name) || (parent?.has(name) ?? false);
    },

    createScope(): Container {
      const child = createScope(container);
      children.push(child);
      return child;
    },

    async dispose(): Promise<void> {
      // Everything is told before anything throws, then the failures travel together.
      // Dropped from the parent first: a scope that closes itself leaves a reference the
      // parent would hold for the life of the process.
      parent?._forget(container);
      const failures: unknown[] = [];
      // A copy: closing a child splices it out of `children`, so walking the array
      // itself stepped over every second sibling.
      for (const child of [...children].reverse()) {
        try {
          await child.dispose();
        } catch (error) {
          failures.push(error);
        }
      }
      children.length = 0;
      for (const value of built.reverse()) {
        try {
          await (value as Disposable).dispose();
        } catch (error) {
          failures.push(error);
        }
      }
      built.length = 0;
      registry.clear();
      if (failures.length > 0) {
        throw new AggregateError(failures, '[container] one or more disposals failed');
      }
    },

    setFallback(resolve: (name: string) => unknown) {
      fallback = resolve;
    },

    _getEntry(name: string): Entry | undefined {
      return registry.get(name) ?? parent?._getEntry(name);
    },

    _forget(child: ScopeContainer) {
      const at = children.indexOf(child);
      if (at !== -1) children.splice(at, 1);
    },

    /** Set on the root, honoured from any scope — a scope inherits it by asking upward. */
    _getFallback() {
      return fallback ?? parent?._getFallback();
    },
  };

  return container;
}

export function createContainer(): Container {
  return createScope();
}
