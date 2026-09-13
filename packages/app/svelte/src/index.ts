/** `@fougere/svelte` — the four primitives, in Svelte, for any host that renders it. */
export { useCommand } from './useFougereData/CommandStore.js';
export { useQuery } from './useFougereData/QueryStore.js';
// The facade a page names, and the one an entity class names for a form.
export { facade, facadeOf } from '@fougere/app/client';
export { useFormFor, type FormOptions } from './useFormFor.js';
export { useCurrentUser } from './useCurrentUser.js';
export { fetcher, CALL_ENDPOINT } from '@fougere/app/client';

export type {
  CallInput,
  EntityClass,
  FormEntity,
  FormField,
  SessionView,
} from '@fougere/app/client';
