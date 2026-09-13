import type { InvocationContext } from '../wire/Invocation.js';

export interface CollectorResolver {
  collect(ctx: InvocationContext): Promise<unknown>;
}
