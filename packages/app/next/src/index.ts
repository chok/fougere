/**
 * `@fougere/next` — what is Next about hosting a Fougere app, and nothing else.
 *
 * The package is deliberately thin, and its thinness is the measurement: the three
 * doors are Web-standard handlers living in `@fougere/app/web`, the four primitives
 * are React hooks living in `@fougere/react`, and neither imports Next. What is
 * left here is mounting (Next has no module API, so routes are three one-line files
 * under `app/`) and `next/headers`, the one import that is genuinely Next's.
 *
 * ```ts
 * // app/%5Ffougere/call/[[...surface]]/route.ts   ← %5F, not _, see routes/call.ts
 * export { POST } from '@fougere/next/call';
 * // app/%5Ffougere/session/route.ts
 * export { GET } from '@fougere/next/session';
 * // app/api/[...fougere]/route.ts
 * export { GET, POST, PUT, PATCH, DELETE } from '@fougere/next/rest';
 * ```
 *
 * Nothing else in the app moves: pages, layouts, existing route handlers and an
 * existing auth setup are untouched. The scan runs on the first request that needs
 * the app (`useFougereApp` is lazy and memoized), so there is no build hook to
 * install and no generated file to keep in sync.
 *
 * Client primitives: `@fougere/react`.
 */
export { invoke, getSession } from './invoke.js';

// `withFougere` is deliberately NOT re-exported here. It is build-time config and
// it pulls terser in; the root entry is imported by pages, so re-exporting it sent
// a bundler into the browser bundle (measured: `esbuild/lib/main.d.ts` failed to
// parse inside `app/page.tsx`). Build-time and runtime do not share a door:
// `@fougere/next/config`.

// The boot, so an app can override its data layer from `instrumentation.ts` the way
// a Nuxt app does from a Nitro plugin.
export {
  configureFougere,
  useFougereApp,
  useFougereAuth,
  sessionViewOf,
  stateFor,
  type FougereServerConfig,
  type SessionView,
} from '@fougere/app';
