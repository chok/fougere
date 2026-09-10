/**
 * ```ts // app/api/[...fougere]/route.ts export { GET, POST, PUT, PATCH, DELETE } from
 * '@fougere/next/rest'; ``` Five names for one handler, because Next decides which verbs a route
 * accepts by which names it exports.
 */
import { rest } from '@fougere/app/web';

export const GET = rest;
export const POST = rest;
export const PUT = rest;
export const PATCH = rest;
export const DELETE = rest;
