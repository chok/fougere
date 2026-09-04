'use client';
/** `@fougere/react` — the four primitives, in React, for any host that renders it. */
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
