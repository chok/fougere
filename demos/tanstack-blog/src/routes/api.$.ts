import { createFileRoute } from '@tanstack/react-router';
import { fougere } from '@fougere/app/web';

/**
 * The REST projection, on a splat so it catches every entity path under `/api`.
 *
 * Which verb reaches which operation is decided off the table `schema-rest`
 * generates — this file does not narrow it, it only lists the verbs TanStack
 * should route here.
 */
export const Route = createFileRoute('/api/$')({
  server: {
    handlers: {
      GET: ({ request }) => fougere(request),
      POST: ({ request }) => fougere(request),
      PUT: ({ request }) => fougere(request),
      PATCH: ({ request }) => fougere(request),
      DELETE: ({ request }) => fougere(request),
    },
  },
});
