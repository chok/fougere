/**
 * Every route file of an app hands its requests here — `export { POST } from '@fougere/next/route'`
 * in `app/%5Ffougere/call/[[...surface]]/route.ts`, the five verbs in `app/api/[...fougere]/route.ts`.
 * Five names for one handler, because Next decides which verbs a route accepts by the names it
 * exports. The folder is `%5Ffougere`, not `_fougere`: the App Router treats a leading underscore as
 * a PRIVATE folder, and `%5F` is Next's own escape for a literal one.
 */
import { fougere } from '@fougere/app/web';

export const GET = fougere;
export const POST = fougere;
export const PUT = fougere;
export const PATCH = fougere;
export const DELETE = fougere;
