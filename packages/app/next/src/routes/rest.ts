/**
 * ```ts
 * // app/api/[...fougere]/route.ts
 * export { GET, POST, PUT, PATCH, DELETE } from '@fougere/next/rest';
 * ```
 *
 * Five names for one handler, because Next decides which verbs a route accepts by
 * which names it exports. Which verb reaches which OPERATION is decided elsewhere,
 * off the table `schema-rest` generates — this file does not narrow it.
 *
 * Next resolves a static segment (`app/api/health/route.ts`) before a catch-all, so
 * mounting this takes nothing away from an app that already serves `/api/*`.
 */
import { fougereRest } from '@fougere/app/web';

export const GET = fougereRest;
export const POST = fougereRest;
export const PUT = fougereRest;
export const PATCH = fougereRest;
export const DELETE = fougereRest;
