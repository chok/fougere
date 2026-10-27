/**
 * `Collect<User>` — resolves one handler input parameter from the invocation context, by the type it
 * collects: `constructor`-free, a parameter `user: User` of an op receives what `collect` answered.
 *
 * Documented: [collectors](https://fougere.dev/docs/business/collect-and-present#collect--a-parameter-filled-by-its-type).
 */
import { upperFirst } from '@fougere/schema';
import type { InvocationContext } from '../wire/InvocationContext.js';

const COLLECT = Symbol.for('fougere.collect');

/**
 * What a collector is: `collect`, and `missing` when a required parameter found nothing. TypeScript
 * erases `<User>`, so the scan reads it, and a frond written by hand says it — `collects: User`.
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

/** Container key of a collector — 'user' → 'UserCollector', 'ability' → 'AbilityCollector'. */
export function collectorKeyOf(type: string): string {
  return `${upperFirst(type)}Collector`;
}
