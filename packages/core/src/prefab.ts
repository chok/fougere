import type { EntityConstructor } from '@fougere/schema';
import type { PresenterViews } from './presenter.js';

/**
 * What a prefab class declares about ITSELF, at runtime.
 *
 * `Crud(Post)`, `Presenter(Post)`, `Repository(Post)`, `Collector(User)` and
 * `Mirror(BookCard)` all fabricate a class, and only the fabricator knows what it was
 * built on: the AST scan is workspace-only, so an INSTALLED prefab resolves to nothing
 * and a statement written in source would be lost. Hence a runtime marker — the same
 * reason `__ops` exists.
 *
 * It was three spellings for one statement: `static __entity` on three of the five, a
 * private `Symbol.for('fougere:x_target')` on the other two, and BOTH on `Repository`
 * and `Mirror` — the same class recording its subject twice, under two names, with two
 * readers that could disagree. A mark that answers one question answers it once.
 */
export interface Prefab {
  /** The shape this class was built on. `Mirror` calls it a shape; it is the same slot. */
  readonly __entity?: EntityConstructor;
  /** The view each computed field emits — `Presenter(Order, { items: [OrderItemView] })`. */
  readonly __views?: PresenterViews;
  /** The view the whole handler speaks — `Crud(Post, PostPublic)`. Same slot, one level up. */
  readonly __output?: EntityConstructor;
}

/**
 * The shape a prefab was built on, or `undefined` when the class is not one.
 *
 * A plain property read: JavaScript walks a constructor's own prototype chain, so a
 * subclass of a prefab answers what its base recorded. Three of the five accessors this
 * replaces walked that chain by hand, and two did not — one question, two mechanisms.
 */
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
