/**
 * ```ts // app/api/[...fougere]/route.ts export { GET, POST, PUT, PATCH, DELETE } from
 * '@fougere/next/rest'; ``` Five names for one handler, because Next decides which verbs a route
 * accepts by which names it exports.
 */
import { fougereRest } from '@fougere/app/web';

export const GET = fougereRest;
export const POST = fougereRest;
export const PUT = fougereRest;
export const PATCH = fougereRest;
export const DELETE = fougereRest;
