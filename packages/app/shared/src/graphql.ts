/** The GraphQL facade — declared like the others, mounted like the others. */
import { Protocols, serves, type App } from '@fougere/core';
import type { Outcome } from './Outcome.js';

/** What a GraphQL request carries, whatever host read it. */
export interface GraphQLRequest {
  query?: string;
  variables?: Record<string, unknown>;
  operationName?: string;
  /** The audience, when the facade was mounted per surface. */
  surface?: string;
  state: Record<string, unknown>;
}

type ExecuteOn = (app: unknown, request: {
  query: string;
  variables?: Record<string, unknown>;
  operationName?: string;
  surface?: string;
  state?: Record<string, unknown>;
}) => Promise<unknown>;

/** What the imported adapter registered — the host names no package, and imports none. */
export function executor(): ExecuteOn {
  return (Protocols.resolve('graphql', 'protocols.graphql') as unknown as { executeOn: ExecuteOn }).executeOn;
}

/** Execute a GraphQL request against the app's own operations. */
export async function serveGraphQL(app: App, request: GraphQLRequest): Promise<Outcome> {
  if (!serves(app.protocols, 'graphql')) return { kind: 'pass' };

  if (!request.query) {
    return { kind: 'error', status: 400, body: { message: 'Missing query' } };
  }

  const executeOn = executor();
  const result = await executeOn(app, {
    query: request.query,
    variables: request.variables,
    operationName: request.operationName,
    surface: request.surface,
    // The same state every other facade stamps: what the server resolved, never the wire.
    state: request.state,
  });

  // A GraphQL error is not an HTTP error: the transport succeeded, and the errors ride
  // in the body where a client is required to look for them.
  return { kind: 'ok', status: 200, body: result as Record<string, unknown> };
}
