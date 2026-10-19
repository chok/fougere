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

/**
 * The state of the request a server-side call runs within — `stateOf` its event, never the whole of
 * Nitro's context, which a call that crosses would carry. Outside a request there is none.
 */
export function stateOfRequest(eventNow: () => Pick<H3Event, 'context'> | undefined): Record<string, unknown> {
  try {
    const event = eventNow();

    return event ? stateOf(event) : {};
  } catch {
    return {};
  }
}
