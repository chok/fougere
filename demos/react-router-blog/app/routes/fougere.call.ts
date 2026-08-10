import { fougereCall } from '@fougere/app/web';

/**
 * The call envelope. `action` is what React Router runs for POST, and it receives a
 * standard Web `Request` — so the door goes in unchanged.
 */
export const action = ({ request }: { request: Request }) => fougereCall(request);
