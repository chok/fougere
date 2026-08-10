import { type RouteConfig, index, route } from '@react-router/dev/routes';

/**
 * Three resource routes and three pages.
 *
 * A resource route is any route with a `loader`/`action` and no default component
 * export — which is exactly the shape `@fougere/app/web` needs, since both take a
 * `Request` and return a `Response`.
 *
 * Note what is NOT here: an escape for the leading underscore. Next needs `%5F`
 * (private folder) and TanStack Router needs `[_]` (pathless layout) because both
 * derive the URL from the file name. React Router declares paths explicitly, so
 * `_fougere/call` means `/_fougere/call` and nothing else.
 */
export default [
  index('routes/published.tsx'),
  route('drafts', 'routes/drafts.tsx'),
  route('new', 'routes/new.tsx'),

  route('_fougere/call', 'routes/fougere.call.ts'),
  route('_fougere/call/*', 'routes/fougere.call-surface.ts'),
  route('_fougere/session', 'routes/fougere.session.ts'),
  route('api/*', 'routes/fougere.rest.ts'),
] satisfies RouteConfig;
