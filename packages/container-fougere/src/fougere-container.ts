import type { Container, Registration, RegisterOptions, Constructor } from '@fougere/container';

interface Entry {
  factory: (container: Container) => unknown;
  lifetime: 'singleton' | 'scoped' | 'transient';
  instance?: unknown;
}

function isClass(fn: unknown): fn is Constructor {
  if (typeof fn !== 'function') return false;
  const str = fn.toString();
  return str.startsWith('class ') || str.startsWith('class{');
}

interface ScopeContainer extends Container {
  _getEntry(name: string): Entry | undefined;
}

function createScope(parent?: ScopeContainer): ScopeContainer {
  const registry = new Map<string, Entry>();

  const container: ScopeContainer = {
    register<T>(name: string, registration: Registration<T>, options?: RegisterOptions) {
      const lifetime = options?.lifetime ?? 'transient';
      const deps = options?.deps ?? [];

      let factory: (c: Container) => unknown;
      if (isClass(registration)) {
        const Ctor = registration;
        factory = (c) => new Ctor(...deps.map((d) => c.resolve(d)));
      } else {
        factory = registration as (c: Container) => unknown;
      }

      registry.set(name, { factory, lifetime });
    },

    registerValue<T>(name: string, value: T) {
      registry.set(name, { factory: () => value, lifetime: 'singleton', instance: value });
    },

    resolve<T>(name: string): T {
      let entry = registry.get(name);

      // Not found locally — look in parent
      if (!entry && parent) {
        const parentEntry = parent._getEntry(name);
        if (parentEntry) {
          if (parentEntry.lifetime === 'scoped') {
            // Scoped: create a local copy so each scope gets its own instance
            entry = { factory: parentEntry.factory, lifetime: 'scoped' };
            registry.set(name, entry);
          } else {
            // Singleton/transient: delegate to parent
            return parent.resolve<T>(name);
          }
        }
      }

      if (!entry) throw new Error(`[container] '${name}' is not registered`);

      if (entry.instance !== undefined) return entry.instance as T;
      const value = entry.factory(container) as T;
      if (entry.lifetime === 'singleton' || entry.lifetime === 'scoped') {
        entry.instance = value;
      }
      return value;
    },

    has(name: string): boolean {
      return registry.has(name) || (parent?.has(name) ?? false);
    },

    createScope(): Container {
      return createScope(container);
    },

    async dispose(): Promise<void> {
      registry.clear();
    },

    _getEntry(name: string): Entry | undefined {
      return registry.get(name) ?? parent?._getEntry(name);
    },
  };

  return container;
}

export function createContainer(): Container {
  return createScope();
}
