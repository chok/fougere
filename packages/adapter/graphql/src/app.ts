import SchemaBuilder from '@pothos/core';
import { graphql, type ExecutionResult, type GraphQLSchema } from 'graphql';
import { registerAll } from './auto-register.js';

/** What a GraphQL request carries, whatever host read it. */
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

/** The app's schema, derived and kept. */
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

/** Execute a query against the app's own operations. */
export async function executeOn(app: AppLike, request: AppQuery): Promise<ExecutionResult> {
  return graphql({
    schema: schemaOf(app, request.surface),
    source: request.query,
    variableValues: request.variables,
    operationName: request.operationName,
    contextValue: { state: request.state ?? {} },
  });
}
