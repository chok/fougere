import { createFileRoute } from '@tanstack/react-router';
import { fougereSession } from '@fougere/app/web';

export const Route = createFileRoute('/_fougere/session')({
  server: {
    handlers: {
      GET: ({ request }) => fougereSession(request),
    },
  },
});
