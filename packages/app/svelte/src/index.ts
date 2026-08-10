/**
 * `@fougere/svelte` — the four primitives, in Svelte, for any host that renders it.
 *
 * There is no `@fougere/sveltekit` beside it, and that is not an omission: SvelteKit
 * serves Web-standard `Request`/`Response` from `+server.ts`, and it hands every
 * `load` function its own `event`, so there is no ambient-request lookup to package.
 * A SvelteKit app mounts `@fougere/app/web` directly, the way the TanStack and React
 * Router demos do. Next needed 124 lines because `next/headers` exists; SvelteKit
 * needs none because it does not.
 *
 * So: one package per UI framework, and a host package only when the host has
 * something that is genuinely its own.
 */
export { useQuery, useCommand, type QueryState, type QueryStore, type CommandStore } from './useFougereData.js';
export { useFormFor, type FormOptions } from './useFormFor.js';
export { useCurrentUser, hydrateSession, refreshSession } from './useCurrentUser.js';
export { fetcher, CALL_ENDPOINT } from '@fougere/app/client';

export type {
  CallInput,
  EntityClass,
  FormEntity,
  FormField,
  SessionView,
} from '@fougere/app/client';
