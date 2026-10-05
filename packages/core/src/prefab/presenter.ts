/**
 * Presenter(Entity) — enriches an entity's output with computed fields.
 *
 * Documented: [presenters](https://fougere.dev/docs/business/presenters).
 */

import { upperFirst, type Entity } from '@fougere/schema';

/**
 * The view a computed field emits — `OrderItemView` for one, `[OrderItemView]` for many.
 * A view is a schema, so it derives: `Order.pick('id', 'status')`, never a hand-written type.
 */
export type PresenterViews = Record<string, Entity | [Entity]>;

/** `Presenter(Order, { items: [OrderItemView] })` — the views its computed fields emit. */
export function Presenter<E extends Entity>(entity: E, views?: PresenterViews) {
  class PresenterBase {
    static readonly __entity = entity;
    static readonly __views = views;
  }

  return PresenterBase;
}

/** List computed field names from a presenter class (own methods minus constructor). */
export function getPresenterFields(ctor: Function): string[] {
  return Object.getOwnPropertyNames(ctor.prototype)
    .filter((name) => name !== 'constructor' && typeof ctor.prototype[name] === 'function');
}

/** Container key of an entity's presenter — 'post' → 'PostPresenter'. */
export function presenterKeyOf(entity: string): string {
  return `${upperFirst(entity)}Presenter`;
}
