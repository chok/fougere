import { Collector } from '@fougere/core';
import type { InvocationContext } from '@fougere/core';
import User from '../entities/User.js';

/**
 * The collector, declared in the frond that OWNS the entity — which is exactly
 * what `Known issues` tells you not to do ("Keep collectors in the consuming
 * frond"). The handler that wants a user lives in `blog`, not here.
 *
 * It reads identity off the invocation state, so a reader can never become an
 * admin by asking.
 */
export default class CurrentUserCollector extends Collector(User) {
  async collect(ctx: InvocationContext) {
    return (ctx.state.user ?? null) as User | null;
  }
}
