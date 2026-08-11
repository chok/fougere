/**
 * The GraphQL door — declared like the others, mounted like the others.
 *
 * Until now GraphQL was the odd one out: `adapters: { graphql: true }` was
 * declarable and nothing read it, while an app that wanted a schema wrote fifteen
 * lines of its own (a Pothos builder, a query type, a mutation type, `registerAll`,
 * then `registerGraphQL` on a router). Every one of those lines is convention —
 * there is no decision in them — so the app declaring the adapter is enough.
 *
 * The packages are imported LAZILY, and that is the same shape `db: 'sqlite'` uses
 * (`resolveStorage` pulls `@fougere/schema-sql` only when a database is declared).
 * `graphql` and `@pothos/core` are heavy and most apps serve none, so a host must not
 * carry them to find out. Declaring the adapter without installing them is refused by
 * name, the way an unresolvable dialect is.
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

/** One executable schema per (app, audience) — building it walks every entity. */
const schemas = new WeakMap<App, Map<string, unknown>>();

async function schemaFor(app: App, surface?: string): Promise<unknown> {
  const perApp = schemas.get(app) ?? new Map<string, unknown>();
  schemas.set(app, perApp);

  const key = surface ?? '';
  const built = perApp.get(key);
  if (built) return built;

  let SchemaBuilder: any;
  let registerAll: any;
  try {
    ({ default: SchemaBuilder } = await import('@pothos/core'));
    ({ registerAll } = await import('@fougere/schema-graphql'));
  } catch (cause) {
    throw new Error(
      "adapters: { graphql: true } is declared, but the packages that serve it are not " +
      "installed. Add `@fougere/schema-graphql` and `@pothos/core` — they are not " +
      'dependencies of the host, because an app that serves no GraphQL should not carry ' +
      'a schema builder to find that out.',
      { cause },
    );
  }

  // Every line here is convention: a builder, the two root types, and the entities
  // the app already scanned. Nothing an app could usefully say differently — which is
  // why declaring the adapter is the whole configuration.
  const builder = new SchemaBuilder({});
  builder.queryType({});
  builder.mutationType({});
  registerAll(builder, app as never, surface ? { surface } : undefined);

  const schema = builder.toSchema();
  perApp.set(key, schema);
  return schema;
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

  const { graphql } = await import('graphql');
  const result = await graphql({
    schema: (await schemaFor(app, request.surface)) as never,
    source: request.query,
    variableValues: request.variables,
    operationName: request.operationName,
    // The same state every other door stamps: what the server resolved, never the wire.
    contextValue: { state: request.state },
  });

  // A GraphQL error is not an HTTP error: the transport succeeded, and the errors ride
  // in the body where a client is required to look for them.
  return { kind: 'ok', status: 200, body: result };
}
