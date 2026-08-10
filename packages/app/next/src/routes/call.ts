/**
 * ```ts
 * // app/%5Ffougere/call/[[...surface]]/route.ts
 * export { POST } from '@fougere/next/call';
 * ```
 *
 * The folder is `%5Ffougere`, not `_fougere`: the App Router treats a leading
 * underscore as a PRIVATE folder and excludes it from routing, and `%5F` is Next's
 * own escape for a literal one. Measured the hard way — the door 404'd while every
 * other route answered.
 *
 * The optional catch-all is what serves a named surface: `/_fougere/call/public`
 * selects the `public` audience.
 */
export { fougereCall as POST } from '@fougere/app/web';
