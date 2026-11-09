import { subjectKeyOf } from '../wire/SubjectKey.js';
import { upperFirst } from '@fougere/schema';
import type { InvocationContext } from '../wire/InvocationContext.js';

const COLLECT = Symbol.for('fougere.collect');

/**
 * `Collect<User>`: `collect` fills a parameter of that type, `missing` refuses when a required one found nothing.
 *
 * Documented: [collectors](https://fougere.dev/docs/access/authentication#know-who-calls).
 */
export abstract class Collect<T> {
  abstract collect(context: InvocationContext): Promise<T | undefined> | T | undefined;
  /** A required parameter nothing filled: refuse in this collector's own words. */
  missing?(context: InvocationContext): never;
}
Object.defineProperty(Collect.prototype, COLLECT, { value: true });

/** Whether a class extends `Collect` — read by a name two copies of core share. */
export function isCollect(ctor: unknown): boolean {
  return typeof ctor === 'function' && (ctor.prototype as Record<symbol, unknown> | undefined)?.[COLLECT] === true;
}

/** Container key of a collector — 'user' → `Collect<User>`, spelled as the type is written. */
export function collectorKeyOf(type: string): string {
  return subjectKeyOf('Collect', upperFirst(type));
}
