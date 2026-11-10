import { Collect, type FrondDeclaration, type InvocationContext } from '@fougere/core';
import { entity, json, nullable, type Entity, type Schema } from '@fougere/schema';

/** Who is signed in on a call, as the auth frond's `session.get`; nobody is `{ user: null }`. */
export function sessionOperation(user: Entity): Required<Pick<FrondDeclaration, 'collectors' | 'handlers'>> {
  class Session extends entity({ user: nullable(json(user as typeof Schema)) }) {}

  class SessionCollector extends Collect<unknown> {
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
    collectors: [{ ctor: SessionCollector, collects: user }],
    handlers: [{ ctor: SessionHandler, operations: { get: { params: { signedIn: { type: user, optional: true as const } }, output: Session } } }],
  };
}
