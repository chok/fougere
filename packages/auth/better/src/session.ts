import { Collector, type FrondDeclaration, type InvocationContext } from '@fougere/core';
import { entity, json, nullable, type Entity, type Schema } from '@fougere/schema';

/**
 * Who is signed in on a call, answered as an operation of the auth frond — `session.get` — so a page
 * asks for its user the way it asks for anything else, and the user's own boundary decides what of
 * it travels. Nobody signed in is an answer, `{ user: null }`, and never a row that is missing.
 */
export function sessionOperation(user: Entity): Required<Pick<FrondDeclaration, 'collectors' | 'handlers'>> {
  class Session extends entity({ user: nullable(json(user as typeof Schema)) }) {}

  class SessionCollector extends Collector(user) {
    async collect(context: InvocationContext) {
      return context.state.user;
    }
  }

  class SessionHandler {
    async get(signedIn?: unknown) {
      return { user: signedIn ?? null };
    }
  }

  return {
    collectors: [SessionCollector],
    handlers: [{ ctor: SessionHandler, operations: { get: { params: { signedIn: { type: user, optional: true as const } }, output: Session } } }],
  };
}
