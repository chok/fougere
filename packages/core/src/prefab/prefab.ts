import type { EntityConstructor } from '@fougere/schema';
import type { PresenterViews } from './presenter.js';

/** What a prefab class declares about ITSELF, at runtime. */
interface Prefab {
  /** The shape this class was built on. `Mirror` calls it a shape; it is the same slot. */
  readonly __entity?: EntityConstructor;
  /** The view each computed field emits — `Presenter(Order, { items: [OrderItemView] })`. */
  readonly __views?: PresenterViews;
  /** The view the whole handler speaks — `Crud(Post, PostPublic)`. Same slot, one level up. */
  readonly __output?: EntityConstructor;
}

/** The shape a prefab was built on, or `undefined` when the class is not one. */
export function targetOf(ctor: unknown): EntityConstructor | undefined {
  return (ctor as Prefab | undefined)?.__entity;
}

/** The views a prefab declares, same rule. */
export function viewsOf(ctor: unknown): PresenterViews | undefined {
  return (ctor as Prefab | undefined)?.__views;
}

/** The handler-wide view a prefab declares, same rule. */
export function outputOf(ctor: unknown): EntityConstructor | undefined {
  return (ctor as Prefab | undefined)?.__output;
}
