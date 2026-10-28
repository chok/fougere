import { Collect } from '../../../../../src/index.js';
import type { InvocationContext } from '../../../../../src/wire/InvocationContext.js';
import User from '../entities/User.js';

/** The session user, put on `ctx.state` by whatever authenticated the call. */
export default class CurrentUserCollector extends Collect<User> {
  async collect(ctx: InvocationContext) {
    return ctx.state.user as User | undefined;
  }
}
