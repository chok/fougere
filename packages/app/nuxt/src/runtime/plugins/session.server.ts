/** Session hydration — server half of useCurrentUser. */
import { defineNuxtPlugin, useRequestEvent, useState } from '#imports';
import { sessionViewOf, type SessionView } from '@fougere/app/client';

export default defineNuxtPlugin(() => {
  const event = useRequestEvent();
  useState<SessionView>('fougere:session', () =>
    sessionViewOf((event?.context ?? {}) as Record<string, unknown>),
  );
});
