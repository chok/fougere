import { fougere } from '@fougere/app/web';

/**
 * The REST projection. `loader` takes GET, `action` takes every other verb — which
 * is React Router's split, not ours: `fougere` reads the method off the request
 * and matches it against the table `schema-rest` generates.
 */
export const loader = ({ request }: { request: Request }) => fougere(request);
export const action = ({ request }: { request: Request }) => fougere(request);
