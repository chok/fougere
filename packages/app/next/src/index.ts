/** `@fougere/next` — what is Next about hosting a Fougere app, and nothing else. */
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
