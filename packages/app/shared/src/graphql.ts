/** The GraphQL facade — declared like the others, mounted like the others. */

/** A document, its variables, and which operation of it to run. */
export interface GraphQLDocument {
  query?: string;
  variables?: Record<string, unknown>;
  operationName?: string;
}

/** Where every host mounts GraphQL unless it says otherwise. */
export const GRAPHQL_PATH = '/graphql';

/**
 * The surface a GraphQL path selects.
 * Ex: `/graphql/public` → `public`.
 */
export function graphqlSurfaceOf(path: string, mountPath = GRAPHQL_PATH): string | undefined {
  const bare = path.replace(/\?.*$/, '');
  if (!bare.startsWith(mountPath)) return undefined;

  return /^\/([A-Za-z0-9_-]+)\/?$/.exec(bare.slice(mountPath.length))?.[1];
}
