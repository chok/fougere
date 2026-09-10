import { createFileRoute } from '@tanstack/react-router';
import { session } from '@fougere/app/web';

export const Route = createFileRoute('/_fougere/session')({
  server: {
    handlers: {
      GET: ({ request }) => session(request),
    },
  },
});
