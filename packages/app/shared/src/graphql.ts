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
 * The audience a GraphQL path selects — the one segment after where it is mounted: `/graphql/public`
 * serves the surface `public`, the way `/_fougere/call/public` does for the envelope.
 */
export function graphqlSurfaceOf(path: string, mountPath = GRAPHQL_PATH): string | undefined {
  const bare = path.replace(/\?.*$/, '');
  if (!bare.startsWith(mountPath)) return undefined;

  return /^\/([A-Za-z0-9_-]+)\/?$/.exec(bare.slice(mountPath.length))?.[1];
}
