/**
 * `Present<Entity>` — enriches an entity's output with computed fields.
 *
 * Documented: [presenters](https://fougere.dev/docs/business/collect-and-present#present--fields-computed-over-the-page).
 */

import { subjectKeyOf } from '../wire/SubjectKey.js';
import { upperFirst, type Entity } from '@fougere/schema';

/**
 * The view a computed field emits — `OrderItemView` for one, `[OrderItemView]` for many.
 * A view is a schema, so it derives: `Order.pick('id', 'status')`, never a hand-written type.
 */
export type PresenterViews = Record<string, Entity | [Entity]>;

const PRESENT = Symbol.for('fougere.present');

/**
 * `Present<Order>` — each method a computed field of `Order`'s output, handed the page and answering
 * one value per row, its type read off what it returns. TypeScript erases `<Order>`, so the scan reads
 * it, and a frond written by hand says it — `presents: Order`.
 */
export abstract class Present<T> {
  declare private readonly presented?: T;
}
Object.defineProperty(Present.prototype, PRESENT, { value: true });

/** Whether a class extends `Present` — read by a name two copies of core share. */
export function isPresent(ctor: unknown): boolean {
  return typeof ctor === 'function' && (ctor.prototype as Record<symbol, unknown> | undefined)?.[PRESENT] === true;
}

/** The computed fields of a presenter: the methods written over `Present`, the classes between included. */
export function getPresenterFields(ctor: Function): string[] {
  const fields = new Set<string>();
  for (let level = ctor.prototype; level && level !== Object.prototype && level !== Present.prototype; level = Object.getPrototypeOf(level)) {
    for (const name of Object.getOwnPropertyNames(level)) {
      if (name !== 'constructor' && typeof level[name] === 'function') fields.add(name);
    }
  }

  return [...fields];
}

/** Container key of an entity's presenter — 'post' → `Present<Post>`, spelled as the type is written. */
export function presenterKeyOf(entity: string): string {
  return subjectKeyOf('Present', upperFirst(entity));
}
