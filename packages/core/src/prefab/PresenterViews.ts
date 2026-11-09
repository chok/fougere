import type { Entity } from '@fougere/schema';

/**
 * The view a computed field emits, one or many.
 * Ex: `OrderItemView`, `[OrderItemView]`.
 */
export type PresenterViews = Record<string, Entity | [Entity]>;
