
import { subjectKeyOf } from '../wire/SubjectKey.js';
import { upperFirst } from '@fougere/schema';

const PRESENT = Symbol.for('fougere.present');

/**
 * `Present<Order>`: each method is a computed field, handed the page and answering one value per row.
 *
 * Documented: [presenters](https://fougere.dev/docs/data/computed-field).
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
