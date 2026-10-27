import { createFileRoute } from '@tanstack/react-router';
import { fougere } from '@fougere/app/web';

export const Route = createFileRoute('/_fougere/session')({
  server: {
    handlers: {
      GET: ({ request }) => fougere(request),
    },
  },
});
