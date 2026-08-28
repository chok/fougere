import { createHttpTransport } from '@fougere/transport-http/client';
import type { CallPage } from '@fougere/core';

/**
 * One page of what another process dispatched.
 *
 * It reads through the same door and the same envelope as any consumer of a remote frond
 * — `createHttpTransport` is the client `remotes:` uses — so the panel holds no privilege:
 * an app that requires an identity refuses it like any other peer, and an app that never
 * installed `@fougere/calls` answers `Unknown rpc operation 'calls'`.
 */
export default class DevtoolsHandler {
  /** Read what a running app has dispatched since a cursor. */
  async execute(input: { url?: string; since?: number }): Promise<CallPage> {
    const url = (input.url ?? 'http://127.0.0.1:3000').replace(/\/$/, '');

    return await createHttpTransport(url)(
      { entity: 'rpc', op: 'calls' },
      { params: {}, query: {}, body: { since: input.since ?? 0 }, state: {} },
    ) as CallPage;
  }
}
