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
  // Construction order, so disposal can run in reverse: a thing built later may
  // hold something built earlier.
  const built: unknown[] = [];
  // The scopes opened from this one. A child is built BY this container, so it is this
  // container's to close — and it is closed first, because it may hold what the parent
  // built while the parent holds nothing of its. Without this a frond's scope, which is
  // where every provider lives, was never disposed at all: it is registered as a VALUE
  // under `frond:<name>`, and a value is not the container's to dispose.
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

      // Nobody holds it. Before failing, ask whoever set a last resort — a frond declared
      // in `remotes` registers nothing here, so its façade is fabricated rather than found.
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
      // The container disposes what it KEEPS. A transient is handed over and
      // forgotten in the same breath — remembering it would be a leak that grows
      // once per call, and its caller is the one who knows when it is done.
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
      // Reverse order, and one failure must not silence the rest: everything gets
      // told, then the errors travel together.
      // Its parent kept a reference so it could close this scope; the scope closing itself
      // makes that reference garbage. Nothing created a scope at RUN time until frames did,
      // so the list only ever grew at boot and stayed bounded — one per request, or one per
      // transaction, and it grows for the life of the process.
      parent?._forget(container);
      const failures: unknown[] = [];
      for (const child of children.reverse()) {
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
