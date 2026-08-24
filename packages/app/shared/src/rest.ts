/**
 * The REST table this app serves, and the rule that matches a request against it.
 *
 * Separated from the h3 handler on purpose: this file holds the whole of what the door
 * DECIDES — which operation a verb and a path name — while `api/crud.ts` only translates
 * that decision into h3. The rule was previously inline, untested, and had drifted into a
 * second REST projection that answered differently from `schema-rest` on all three counts
 * (verb, path, exposure).
 */
import { generateRoutes } from '@fougere/adapter-rest';
import type { App } from '@fougere/core';

/** One row of the canonical table, in the form this door matches against. */
export interface Matchable {
  method: string;
  /** `route.path` split once: a literal segment, or `:name` to capture. */
  segments: string[];
  path: string;
  entityName: string;
  operationName: string;
}

export type RouteMatch =
  | { kind: 'match'; route: Matchable; params: Record<string, string> }
  /** The path is served, the verb is not — the answer that used to be a mutation. */
  | { kind: 'method-not-allowed'; allow: string[] }
  /** Not a Fougère path at all: the app's own `/api/*` handlers must still see it. */
  | null;

// Keyed on the app, which `useFougereApp` memoizes — the table derives from the boot, so
// it changes exactly when the app does.
const tables = new WeakMap<App, Matchable[]>();

/**
 * The table, per frond.
 *
 * `generateRoutes` prefixes every path the same way, while this door addresses a frond by
 * name (`/api/{frond}/{plural}`) — so it runs once per frond, each with its own prefix and
 * a filter naming it. That frond loop is the only thing this file knows that `schema-rest`
 * does not; the verbs, the paths and the membership rule all come from there.
 */
export function tableOf(app: App): Matchable[] {
  const cached = tables.get(app);
  if (cached) return cached;

  const table = app.fronds.flatMap((frond) =>
    generateRoutes(app, {
      prefix: `/${frond.name}`,
      filter: (_entity, frondName) => frondName === frond.name,
    }).map((route) => ({
      method: route.method as string,
      segments: route.path.split('/').filter(Boolean),
      path: route.path,
      entityName: route.entityName,
      operationName: route.operationName,
    })),
  );

  tables.set(app, table);
  return table;
}

/** The captured params if this pattern accepts these segments, else null. */
function paramsOf(route: Matchable, segments: string[]): Record<string, string> | null {
  if (route.segments.length !== segments.length) return null;

  const params: Record<string, string> = {};
  for (let i = 0; i < segments.length; i++) {
    const pattern = route.segments[i]!;
    if (pattern.startsWith(':')) params[pattern.slice(1)] = decodeURIComponent(segments[i]!);
    else if (pattern !== segments[i]) return null;
  }
  return params;
}

/** How many segments a pattern leaves open — fewer is more specific. */
function openness(route: Matchable): number {
  return route.segments.filter((s) => s.startsWith(':')).length;
}

/**
 * Verbs this door accepts in place of the one the table names.
 *
 * `deriveMethod` gives `update` a single verb, PUT, while this door has always served
 * PATCH on it too — and says so (`docs/infra/surfaces`, "PUT · PATCH"). An alias keeps
 * that promise without giving the table a second row: both are mutations on a row, so
 * nothing is widened, and the one thing the table decides — WHICH operation a path names —
 * is still decided there alone.
 */
const ALIASES: Record<string, string> = { PATCH: 'PUT' };

/**
 * Path first, method second — a router's order, and what makes a 405 possible at all.
 *
 * The order matters where the two overlap: `/posts/publish` and `/posts/:id` both accept
 * `GET /posts/publish`. Taking the most specific path first means the answer is "that verb
 * is refused here", not `findById('publish')` — and never `publish()`, which is what this
 * door used to do with the caller's session cookie attached.
 */
export function matchRoute(table: Matchable[], method: string, segments: string[]): RouteMatch {
  const matches = table
    .map((route) => ({ route, params: paramsOf(route, segments) }))
    .filter((m): m is { route: Matchable; params: Record<string, string> } => m.params !== null);

  if (matches.length === 0) return null;

  const best = Math.min(...matches.map((m) => openness(m.route)));
  const candidates = matches.filter((m) => openness(m.route) === best);

  const wanted = ALIASES[method] ?? method;
  const matched = candidates.find((m) => m.route.method === wanted);
  if (matched) return { kind: 'match', route: matched.route, params: matched.params };

  return {
    kind: 'method-not-allowed',
    allow: [...new Set(candidates.map((m) => m.route.method))].sort(),
  };
}
