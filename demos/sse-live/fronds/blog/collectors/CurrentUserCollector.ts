import { Collector, ErrorCode, FougereError } from '@fougere/core';
import type { InvocationContext } from '@fougere/core';
import User from '../entities/User.js';

/**
 * Who is asking. The SSE facade and the ordinary call facade put the same value on
 * `state.user`, so a handler never learns which one a request came through.
 */
export default class CurrentUserCollector extends Collector(User) {
  async collect(ctx: InvocationContext) {
    return ctx.state.user as User | undefined;
  }

  /** A required `user: User` with nobody signed in. */
  missing(): never {
    throw new FougereError({ code: ErrorCode.UNAUTHORIZED, message: 'sign in to write' });
  }
}
