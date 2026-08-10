'use client';
/**
 * `@fougere/react` — the four primitives, in React, for any host that renders it.
 *
 * It was extracted from `@fougere/next` once a second React host was on the table,
 * and the extraction was cheap for a measurable reason: the hooks never imported
 * Next. They reach `@fougere/app/client` and `react`, and talk to the server over
 * `fetch` on same-origin paths — which is all a React app has in common with
 * another React app.
 *
 * The Vue side has no counterpart on purpose. Nuxt's composables lean on
 * `useAsyncData`, `useRequestFetch`, `useState` and `refreshNuxtData` — Nuxt's data
 * layer, not Vue's — so a `@fougere/vue` would have to rebuild what Nuxt gives for
 * free, and there is no second Vue host asking for it.
 */
export { useQuery, useCommand } from './useFougereData.js';
export { useFormFor, type FormOptions } from './useFormFor.js';
export { useCurrentUser, FougereSession } from './useCurrentUser.js';
export { fetcher, CALL_ENDPOINT } from './transport.js';

export type {
  CallInput,
  EntityClass,
  FormEntity,
  FormField,
  SessionView,
} from '@fougere/app/client';
