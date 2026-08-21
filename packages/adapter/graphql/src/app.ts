import SchemaBuilder from '@pothos/core';
import { graphql, type ExecutionResult, type GraphQLSchema } from 'graphql';
import { registerAll } from './auto-register.js';

/**
 * What a GraphQL request carries, whatever host read it.
 *
 * The same shape a door hands in, so a host translates its own request once and this
 * package never learns what an HTTP framework is.
 */
export interface AppQuery {
  query: string;
  variables?: Record<string, unknown>;
  operationName?: string;
  /** The audience, when the door was mounted per surface. */
  surface?: string;
  /** What the server resolved about the caller — never what the wire claimed. */
  state?: Record<string, unknown>;
}

/** The shape this package needs of an app: its fronds, and how to reach a façade. */
type AppLike = Parameters<typeof registerAll>[1];

/** One executable schema per (app, audience) — building it walks every entity. */
const schemas = new WeakMap<object, Map<string, GraphQLSchema>>();

/**
 * The app's schema, derived and kept.
 *
 * Every line of the derivation is convention — a builder, the two root types, and the
 * entities the app already scanned — so nothing an app could usefully say differently.
 * Declaring `adapters: { graphql: true }` is the whole configuration.
 *
 * It lives HERE, beside Pothos, and not in the host package that used to hold it. The
 * separation had a cost no comment could pay: `graphql` guards its types with
 * `instanceOf`, so a schema built by one loaded copy is refused by another with *"from
 * another module or realm"*. Building and executing across a package boundary made two
 * copies possible; on this side of it there is one.
 */
export function schemaOf(app: AppLike, surface?: string): GraphQLSchema {
  const perApp = schemas.get(app as object) ?? new Map<string, GraphQLSchema>();
  schemas.set(app as object, perApp);

  const key = surface ?? '';
  const built = perApp.get(key);
  if (built) return built;

  const builder = new SchemaBuilder({});
  builder.queryType({});
  builder.mutationType({});
  registerAll(builder as never, app, surface ? { surface } : undefined);

  const schema = builder.toSchema() as GraphQLSchema;
  perApp.set(key, schema);
  return schema;
}

/**
 * Execute a query against the app's own operations.
 *
 * Returns the GraphQL result as it is: a GraphQL error is not a transport error, and the
 * errors ride in the body where a client is required to look for them. Turning that into
 * a status belongs to whichever door asked.
 */
export async function executeOn(app: AppLike, request: AppQuery): Promise<ExecutionResult> {
  return graphql({
    schema: schemaOf(app, request.surface),
    source: request.query,
    variableValues: request.variables,
    operationName: request.operationName,
    contextValue: { state: request.state ?? {} },
  });
}
