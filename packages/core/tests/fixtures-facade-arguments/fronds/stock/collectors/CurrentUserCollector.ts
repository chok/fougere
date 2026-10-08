import { Collector } from '@fougere/core';
import type { InvocationContext } from '@fougere/core';
import User from '../entities/User.js';

export default class CurrentUserCollector extends Collector(User) {
  async collect(ctx: InvocationContext) {
    return ctx.state.user as User | undefined;
  }
}
