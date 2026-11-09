import type { H3Event } from 'h3';

/** What a call carries of the request: the session, without its token, and nothing else. */
export function stateOf(event: Pick<H3Event, 'context'>): Record<string, unknown> {
  const { user, session } = event.context;
  const { token: _token, ...carried } = (session ?? {}) as Record<string, unknown>;

  return {
    ...(user === undefined ? {} : { user }),
    ...(session === undefined ? {} : { session: carried }),
  };
}

/** The state of the request a server-side call runs within; none outside a request. */
export function stateOfRequest(eventNow: () => Pick<H3Event, 'context'> | undefined): Record<string, unknown> {
  try {
    const event = eventNow();

    return event ? stateOf(event) : {};
  } catch {
    return {};
  }
}
