/**
 * Every route file of an app hands its requests here — `export { POST } from '@fougere/next/route'`
 * in `app/%5Ffougere/call/[[...surface]]/route.ts`, the five verbs in `app/api/[...fougere]/route.ts`.
 * Five names for one handler, because Next decides which verbs a route accepts by the names it
 * exports. The folder is `%5Ffougere`, not `_fougere`: the App Router treats a leading underscore as
 * a PRIVATE folder, and `%5F` is Next's own escape for a literal one.
 */
import { fougere } from '@fougere/app/web';

// Next hands a route its own `{ params }` second, which is not the caller's state.
const handle = (request: Request) => fougere(request);

export const GET = handle;
export const POST = handle;
export const PUT = handle;
export const PATCH = handle;
export const DELETE = handle;
