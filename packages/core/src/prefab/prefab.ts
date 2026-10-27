import type { Entity } from '@fougere/schema';
import type { PresenterViews } from './presenter.js';

/** What a prefab class declares about ITSELF, at runtime. */
interface Prefab {
  /** The shape this class was built on. `Mirror` calls it a shape; it is the same slot. */
  readonly __entity?: Entity;
  /** The view each computed field emits — `{ items: [OrderItemView] }`. */
  readonly __views?: PresenterViews;
  /** The view the whole handler speaks — `Repository<PostPublic>`. Same slot, one level up. */
  readonly __output?: Entity;
}

/** The shape a prefab was built on, or `undefined` when the class is not one. */
export function targetOf(ctor: unknown): Entity | undefined {
  return (ctor as Prefab | undefined)?.__entity;
}

/** The views a prefab declares, same rule. */
export function viewsOf(ctor: unknown): PresenterViews | undefined {
  return (ctor as Prefab | undefined)?.__views;
}

/** The handler-wide view a prefab declares, same rule. */
export function outputOf(ctor: unknown): Entity | undefined {
  return (ctor as Prefab | undefined)?.__output;
}

/**
 * The class the boot builds from one written on an erased generic — `Collect<User>`, `Present<Post>` —
 * carrying the subject the scan read or the statement said, and nothing else of its own.
 */
export function builtOn<T extends abstract new (...args: never[]) => unknown>(ctor: T, subject: Entity): T {
  const built = BUILT.get(ctor) ?? new Map<Entity, unknown>();
  const known = built.get(subject);
  if (known) return known as T;

  const Written = ctor as unknown as new (...args: unknown[]) => object;
  const Built = class extends Written {
    static readonly __entity = subject;
  };
  Object.defineProperty(Built, 'name', { value: Written.name });
  Object.defineProperty(Built, 'length', { value: Written.length });
  BUILT.set(ctor, built.set(subject, Built));

  return Built as unknown as T;
}

const BUILT = new WeakMap<object, Map<Entity, unknown>>();

