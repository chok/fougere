import type { H3Event } from 'h3';

/**
 * What a call carries of the request: the session the auth middleware put on the event, without
 * its token, and nothing else of its context — the rest is Nitro's, and a call that crosses
 * would carry it.
 */
export function stateOf(event: Pick<H3Event, 'context'>): Record<string, unknown> {
  const { user, session } = event.context;
  const { token: _token, ...carried } = (session ?? {}) as Record<string, unknown>;

  return {
    ...(user === undefined ? {} : { user }),
    ...(session === undefined ? {} : { session: carried }),
  };
}
