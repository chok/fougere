/** The GraphQL door — declared like the others, mounted like the others. */
import type { App } from '@fougere/core';
import type { Outcome } from './serve.js';

/** What a GraphQL request carries, whatever host read it. */
export interface GraphQLRequest {
  query?: string;
  variables?: Record<string, unknown>;
  operationName?: string;
  /** The audience, when the door was mounted per surface. */
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

async function executor(): Promise<ExecuteOn> {
  try {
    const { executeOn } = await import('@fougere/adapter-graphql');
    return executeOn as unknown as ExecuteOn;
  } catch (cause) {
    throw new Error(
      "adapters: { graphql: true } is declared, but the package that serves it is not " +
      'installed. Add `@fougere/adapter-graphql` — it is not a dependency of the host, ' +
      'because an app that serves no GraphQL should not carry a schema builder to find ' +
      'that out.',
      { cause },
    );
  }
}

/** Execute a GraphQL request against the app's own operations. */
export async function serveGraphQL(app: App, request: GraphQLRequest): Promise<Outcome> {
  if (!app.adapters?.graphql) return { kind: 'pass' };

  if (!request.query) {
    return { kind: 'error', status: 400, body: { message: 'Missing query' } };
  }

  const executeOn = await executor();
  const result = await executeOn(app, {
    query: request.query,
    variables: request.variables,
    operationName: request.operationName,
    surface: request.surface,
    // The same state every other door stamps: what the server resolved, never the wire.
    state: request.state,
  });

  // A GraphQL error is not an HTTP error: the transport succeeded, and the errors ride
  // in the body where a client is required to look for them.
  return { kind: 'ok', status: 200, body: result as Record<string, unknown> };
}
