import { Collector } from '../../../../../src/index.js';
import type { InvocationContext } from '../../../../../src/wire/invocation.js';
import User from '../entities/User.js';

/** The session user, put on `ctx.state` by whatever authenticated the call. */
export default class CurrentUserCollector extends Collector(User) {
  async collect(ctx: InvocationContext) {
    return (ctx.state.user ?? null) as User | null;
  }
}
