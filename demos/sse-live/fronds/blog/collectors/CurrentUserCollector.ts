import { Collector } from '@fougere/core';
import type { InvocationContext } from '@fougere/core';
import User from '../entities/User.js';

/**
 * Who is asking. The SSE door and the ordinary call door put the same value on
 * `state.user`, so a handler never learns which one a request came through.
 */
export default class CurrentUserCollector extends Collector(User) {
  async collect(ctx: InvocationContext) {
    return (ctx.state.user ?? null) as User | null;
  }
}
