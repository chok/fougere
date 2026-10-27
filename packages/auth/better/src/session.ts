import { Collector, type InvocationContext } from '@fougere/core';
import type { Entity } from '@fougere/schema';

/**
 * Who is signed in on a call, answered as an operation of the auth frond — `session.get` — so a page
 * asks for its user the way it asks for anything else, and the user's own boundary decides what of
 * it travels.
 */
export function sessionOperation(user: Entity) {
  class SessionCollector extends Collector(user) {
    async collect(context: InvocationContext) {
      return context.state.user;
    }
  }

  class SessionHandler {
    async get(signedIn?: unknown) {
      return signedIn ?? null;
    }
  }

  return {
    collector: SessionCollector,
    handler: { ctor: SessionHandler, operations: { get: { params: { signedIn: { type: user, optional: true as const } }, output: user } } },
  };
}
