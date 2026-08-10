import { fougereRest } from '@fougere/app/web';

/**
 * The REST projection on a rest-parameter route, so it catches every entity path
 * under `/api`. A more specific route of the app's own — `src/routes/api/health/`
 * — is matched first by SvelteKit, so mounting this takes nothing away.
 */
const handle = ({ request }: { request: Request }) => fougereRest(request);

export const GET = handle;
export const POST = handle;
export const PUT = handle;
export const PATCH = handle;
export const DELETE = handle;
