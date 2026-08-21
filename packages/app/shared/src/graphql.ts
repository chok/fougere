/**
 * The GraphQL door — declared like the others, mounted like the others.
 *
 * Until now GraphQL was the odd one out: `adapters: { graphql: true }` was
 * declarable and nothing read it, while an app that wanted a schema wrote fifteen
 * lines of its own (a Pothos builder, a query type, a mutation type, `registerAll`,
 * then `registerGraphQL` on a router). Every one of those lines is convention —
 * there is no decision in them — so the app declaring the adapter is enough.
 *
 * The package is imported LAZILY, the same shape `db: 'sqlite'` uses (`resolveStorage`
 * pulls `@fougere/adapter-sql` only when a database is declared). A schema builder is
 * heavy and most apps serve none, so a host must not carry one to find out. Declaring
 * the adapter without installing it is refused by name, the way an unresolvable dialect is.
 *
 * This file used to BUILD the schema — a Pothos builder, `registerAll`, then `graphql()`
 * — which made it the only schema constructor in the repo, in the package least entitled
 * to be one. Two costs, one cause: the derivation sat away from the adapter whose job it
 * is, and `graphql` guards its types with `instanceOf`, so a schema built on one side of
 * the package boundary was refused on the other as coming *"from another module or
 * realm"*. Both are gone: `@fougere/adapter-graphql` derives and executes, this door
 * translates the result into an `Outcome`.
 */
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

/**
 * Execute a GraphQL request against the app's own operations.
 *
 * `pass` when the app declares no GraphQL adapter — the same answer `serveRest` gives,
 * so a host that mounted the door takes nothing away from an app that did not ask for it.
 */
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
