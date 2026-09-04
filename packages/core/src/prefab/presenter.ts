/** Presenter(Entity) — enriches an entity's output with computed fields. */

import { upperFirst, type EntityConstructor } from '@fougere/schema';

/**
 * The view a computed field emits — `OrderItemView` for one, `[OrderItemView]` for many.
 * A view is a schema, so it derives: `Order.pick('id', 'status')`, never a hand-written type.
 */
export type PresenterViews = Record<string, EntityConstructor | [EntityConstructor]>;

/** `Presenter(Order, { items: */
export function Presenter<E extends EntityConstructor>(entity: E, views?: PresenterViews) {
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
