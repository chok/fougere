import type { InvocationContext } from '../../wire/InvocationContext.js';

export interface CollectorResolver {
  collect(ctx: InvocationContext): Promise<unknown>;
  /**
   * Throws what a required parameter it found nothing for is refused with — `UNAUTHORIZED` for a
   * user — and may tell one absence from another by the call: none signed in, a session expired.
   */
  missing?(ctx: InvocationContext): void;
}
