import { Collect, ErrorCode, FougereError } from '@fougere/core';
import type { InvocationContext } from '@fougere/core';
import User from '@fronds/user/entities/User.js';

/**
 * The auth middleware (from @fougere/nuxt) puts the session user on
 * `ctx.state.user` — this collector surfaces it to any handler that
 * declares a `user?: User` param.
 */
export default class CurrentUserCollector extends Collect<User> {
  async collect(ctx: InvocationContext) {
    return ctx.state.user as User | undefined;
  }

  /** A required `user: User` with nobody signed in. */
  missing(): never {
    throw new FougereError({ code: ErrorCode.UNAUTHORIZED, message: 'Sign in to write' });
  }
}
