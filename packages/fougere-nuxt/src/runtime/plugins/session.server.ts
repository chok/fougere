/**
 * Session hydration — server half of useCurrentUser. The auth middleware
 * already resolved the user onto event.context; this plugin copies the
 * session view into state so it rides the payload to the client. The
 * page arrives already knowing its user — no round-trip.
 */
import { defineNuxtPlugin, useRequestEvent, useState } from '#imports';
import { sessionViewOf, type SessionView } from '../session/view.js';

export default defineNuxtPlugin(() => {
  const event = useRequestEvent();
  useState<SessionView>('fougere:session', () =>
    sessionViewOf((event?.context ?? {}) as Record<string, unknown>),
  );
});
