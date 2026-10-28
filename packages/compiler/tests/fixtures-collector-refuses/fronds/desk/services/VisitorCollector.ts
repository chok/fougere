import { Collect, ErrorCode, FougereError } from '@fougere/core';
import type { InvocationContext } from '@fougere/core';
import Visitor from '../entities/Visitor.js';
import { signInFirst } from '../rules/session.js';

export default class VisitorCollector extends Collect<Visitor> {
  async collect(ctx: InvocationContext) {
    if (ctx.state.banned) throw new FougereError({ code: ErrorCode.FORBIDDEN, message: 'Banned' });

    return ctx.state.visitor as Visitor | undefined;
  }

  missing(): never {
    return signInFirst();
  }
}
