/**
 * ```ts // app/%5Ffougere/call/[[...surface]]/route.ts export { POST } from '@fougere/next/call';
 * ``` The folder is `%5Ffougere`, not `_fougere`: the App Router treats a leading underscore as a
 * PRIVATE folder and excludes it from routing, and `%5F` is Next's own escape for a literal one.
 */
export { fougereCall as POST } from '@fougere/app/web';
