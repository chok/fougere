import type { InvocationContext } from '../../wire/InvocationContext.js';

export interface CollectorResolver {
  collect(ctx: InvocationContext): Promise<unknown>;
  /**
   * Throws what a required parameter it found nothing for is refused with.
   * Ex: `UNAUTHORIZED`.
   */
  missing?(ctx: InvocationContext): void;
}
