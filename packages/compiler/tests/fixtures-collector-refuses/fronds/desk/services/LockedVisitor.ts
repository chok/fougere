import { ErrorCode, FougereError } from '@fougere/core';
import type { Collect, InvocationContext } from '@fougere/core';
import type Visitor from '../entities/Visitor.js';

export default class LockedVisitor implements Partial<Collect<Visitor>> {
  constructor(private inner: Collect<Visitor>) {}

  async collect(ctx: InvocationContext) {
    if (ctx.state.locked) throw new FougereError({ code: ErrorCode.CONFLICT, message: 'Locked' });

    return this.inner.collect(ctx);
  }
}
