import type { InvocationContext } from '../wire/InvocationContext.js';

export interface CollectorResolver {
  collect(ctx: InvocationContext): Promise<unknown>;
}
