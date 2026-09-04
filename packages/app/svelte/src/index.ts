/** `@fougere/svelte` — the four primitives, in Svelte, for any host that renders it. */
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
