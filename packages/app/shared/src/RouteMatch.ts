import { generateRoutes, type RouteDefinition } from '@fougere/adapter-rest';
import type { App } from '@fougere/core';
import type { Matchable } from './Matchable.js';

export type RouteMatch =
  | { kind: 'match'; route: RouteDefinition; params: Record<string, string> }
  /** The path is served, the verb is not — the answer that used to be a mutation. */
  | { kind: 'method-not-allowed'; allow: string[] }
  /** Not a Fougère path at all: the app's own `/api/*` handlers must still see it. */
  | null;

// Keyed on the app, which `useFougereApp` memoizes — the table derives from the boot, so
// it changes exactly when the app does.
const tables = new WeakMap<App, Matchable[]>();

/** The table, per frond. */
export function tableOf(app: App): Matchable[] {
  const cached = tables.get(app);
  if (cached) return cached;

  const table = generateRoutes(app).map((route) => ({ segments: route.path.split('/').filter(Boolean), route }));

  tables.set(app, table);

  return table;
}

/** The captured params if this pattern accepts these segments, else null. */
function paramsOf(row: Matchable, segments: string[]): Record<string, string> | null {
  if (row.segments.length !== segments.length) return null;

  const params: Record<string, string> = {};
  for (let i = 0; i < segments.length; i++) {
    const pattern = row.segments[i]!;
    if (pattern.startsWith(':')) params[pattern.slice(1)] = decodeURIComponent(segments[i]!);
    else if (pattern !== segments[i]) return null;
  }

  return params;
}

/** How many segments a pattern leaves open — fewer is more specific. */
function openness(row: Matchable): number {
  return row.segments.filter((s) => s.startsWith(':')).length;
}

/** Path first, method second — a router's order, and what makes a 405 possible at all. */
export function matchRoute(table: Matchable[], method: string, segments: string[]): RouteMatch {
  const matches = table
    .map((row) => ({ row, params: paramsOf(row, segments) }))
    .filter((m): m is { row: Matchable; params: Record<string, string> } => m.params !== null);

  if (matches.length === 0) return null;

  const best = Math.min(...matches.map((m) => openness(m.row)));
  const candidates = matches.filter((m) => openness(m.row) === best);

  const matched = candidates.find((m) => m.row.route.method === method);
  if (matched) return { kind: 'match', route: matched.row.route, params: matched.params };

  return {
    kind: 'method-not-allowed',
    allow: [...new Set(candidates.map((m) => m.row.route.method as string))].sort(),
  };
}
