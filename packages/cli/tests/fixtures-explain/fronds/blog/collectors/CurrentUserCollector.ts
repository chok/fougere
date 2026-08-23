import { Collector, type InvocationContext } from '@fougere/core';
import User from '../entities/User.js';

export default class CurrentUserCollector extends Collector(User) {
  async collect(ctx: InvocationContext): Promise<User | undefined> {
    return ctx.state.user as User | undefined;
  }
}
