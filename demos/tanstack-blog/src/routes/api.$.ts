import { createFileRoute } from '@tanstack/react-router';
import { rest } from '@fougere/app/web';

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
      GET: ({ request }) => rest(request),
      POST: ({ request }) => rest(request),
      PUT: ({ request }) => rest(request),
      PATCH: ({ request }) => rest(request),
      DELETE: ({ request }) => rest(request),
    },
  },
});
