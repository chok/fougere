/** The GraphQL facade — declared like the others, mounted like the others. */
import { Protocols, serves, type App, type Door } from '@fougere/core';
import type { Outcome } from './Outcome.js';

/** A document, its variables, and which operation of it to run. */
export interface GraphQLDocument {
  query?: string;
  variables?: Record<string, unknown>;
  operationName?: string;
}

/** What a GraphQL request carries, whatever host read it — the document still to read. */
export interface GraphQLRequest {
  document: () => Promise<GraphQLDocument | undefined>;
  /** The audience, when the facade was mounted per surface. */
  surface?: string;
  state: Record<string, unknown>;
  /** The request's headers — what a cookie-kept state arrives in. */
  headers?: Headers;
}

type GraphQLDoor = Door<
  { document: GraphQLRequest['document']; state: Record<string, unknown>; headers?: Headers },
  unknown,
  { status: number; data: unknown; headers?: Record<string, string | string[]> }
>;

/** Where every host mounts GraphQL unless it says otherwise. */
export const GRAPHQL_PATH = '/graphql';

/**
 * The audience a GraphQL path selects — the one segment after where it is mounted: `/graphql/public`
 * serves the surface `public`, the way `/_fougere/call/public` does for the envelope.
 */
export function graphqlSurfaceOf(path: string, mountPath = GRAPHQL_PATH): string | undefined {
  const bare = path.replace(/\?.*$/, '');
  if (!bare.startsWith(mountPath)) return undefined;

  return /^\/([A-Za-z0-9_-]+)\/?$/.exec(bare.slice(mountPath.length))?.[1];
}

/** What the imported adapter registered — the host names no package, and imports none. */
function doorOf(app: App, surface?: string): GraphQLDoor {
  const registered = Protocols.resolve('graphql', 'protocols.graphql') as unknown as { door: (app: App, surface?: string) => GraphQLDoor };

  return registered.door(app, surface);
}

/** Execute a GraphQL request against the app's own operations, through its door. */
export async function serveGraphQL(app: App, request: GraphQLRequest): Promise<Outcome> {
  if (!serves(app.protocols, 'graphql')) return { kind: 'pass' };

  // The same state every other facade stamps: what the server resolved, never the wire.
  const { status, data, headers } = await app.answer(doorOf(app, request.surface), {
    document: request.document, state: request.state, ...(request.headers && { headers: request.headers }),
  });
  if (status === 200) return { kind: 'ok', status, body: data, ...(headers && { headers }) };

  // A request the engine never ran — no query, a body refused — has no result, only its errors.
  const [first] = (data as { errors: { message: string }[] }).errors;

  return { kind: 'error', status, body: { message: first!.message, ...(data as Record<string, unknown>) } };
}
