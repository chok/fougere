import { createFileRoute } from '@tanstack/react-router';
import { fougereCall } from '@fougere/app/web';

/**
 * The call envelope.
 *
 * `[_]` escapes the leading underscore: bare `_fougere` would make this a PATHLESS
 * layout route in TanStack Router, the same trap Next has for the same segment and
 * for a different reason (there it is a private folder). Two hosts, two escapes,
 * one wire path — `/_fougere/call`, which is what the browser client knows.
 *
 * The handler takes a standard Web `Request`, so there is nothing to translate:
 * `fougereCall` is the door itself, shared with Next.
 */
export const Route = createFileRoute('/_fougere/call')({
  server: {
    handlers: {
      POST: ({ request }) => fougereCall(request),
    },
  },
});
