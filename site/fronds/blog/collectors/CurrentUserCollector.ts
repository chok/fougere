import { Collector } from '@fougere/core';
import type { InvocationContext } from '@fougere/core';
import User from '@frond/user/entities/User.js';

/**
 * The auth middleware (from @fougere/nuxt) puts the session user on
 * `ctx.state.user` — this collector surfaces it to any handler that
 * declares a `user: User | null` param.
 */
export default class CurrentUserCollector extends Collector(User) {
  async collect(ctx: InvocationContext) {
    return (ctx.state.user ?? null) as User | null;
  }
}
