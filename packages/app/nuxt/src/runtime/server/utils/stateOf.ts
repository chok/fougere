import type { H3Event } from 'h3';

/**
 * What a call carries of the request: the session the auth middleware put on the event, and
 * nothing else of its context — the rest is Nitro's, and a call that crosses would carry it.
 */
export function stateOf(event: Pick<H3Event, 'context'>): Record<string, unknown> {
  const { user, session } = event.context;

  return {
    ...(user === undefined ? {} : { user }),
    ...(session === undefined ? {} : { session }),
  };
}
