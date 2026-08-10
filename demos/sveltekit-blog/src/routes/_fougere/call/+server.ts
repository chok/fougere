import { fougereCall } from '@fougere/app/web';

/**
 * The call envelope. A SvelteKit `+server.ts` handler receives a `RequestEvent`
 * whose `request` is a standard Web `Request`, and returns a `Response` — so the
 * door goes in unchanged, with no adapter package in between.
 */
export const POST = ({ request }: { request: Request }) => fougereCall(request);
