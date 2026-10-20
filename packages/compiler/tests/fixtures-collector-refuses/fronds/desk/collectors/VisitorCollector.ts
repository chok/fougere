import { Collector } from '@fougere/core';
import type { InvocationContext } from '@fougere/core';
import Visitor from '../entities/Visitor.js';
import { signInFirst } from '../rules/session.js';

export default class VisitorCollector extends Collector(Visitor) {
  async collect(ctx: InvocationContext) {
    return ctx.state.visitor as Visitor | undefined;
  }

  missing(): never {
    return signInFirst();
  }
}
