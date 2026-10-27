/**
 * ```ts // app/api/[...fougere]/route.ts export { GET, POST, PUT, PATCH, DELETE } from
 * '@fougere/next/rest'; ``` Five names for one handler, because Next decides which verbs a route
 * accepts by which names it exports.
 */
import { fougere } from '@fougere/app/web';

export const GET = fougere;
export const POST = fougere;
export const PUT = fougere;
export const PATCH = fougere;
export const DELETE = fougere;
