/** Session hydration — server half of useCurrentUser: the page ships with its user, no round-trip. */
import { defineNuxtPlugin, useRequestFetch, useState } from '#imports';
import { sessionOf, type Fetcher, type SessionView } from '@fougere/app/client';

export default defineNuxtPlugin(async () => {
  const view = await sessionOf(useRequestFetch() as Fetcher);
  useState<SessionView>('fougere:session', () => view);
});
