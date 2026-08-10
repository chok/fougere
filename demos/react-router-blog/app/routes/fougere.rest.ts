import { fougereRest } from '@fougere/app/web';

/**
 * The REST projection. `loader` takes GET, `action` takes every other verb — which
 * is React Router's split, not ours: `fougereRest` reads the method off the request
 * and matches it against the table `schema-rest` generates.
 */
export const loader = ({ request }: { request: Request }) => fougereRest(request);
export const action = ({ request }: { request: Request }) => fougereRest(request);
