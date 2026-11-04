import type { Entity } from '@fougere/schema';

/**
 * The view a computed field emits — `OrderItemView` for one, `[OrderItemView]` for many.
 * A view is a schema, so it derives: `Order.pick('id', 'status')`, never a hand-written type.
 */
export type PresenterViews = Record<string, Entity | [Entity]>;
