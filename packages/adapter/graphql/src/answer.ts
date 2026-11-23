import { ErrorCode, FougereError, jsonBodyOf, type App } from '@fougere/core';
import { responseOf } from '@fougere/http';
import { schemaOf } from './app.js';
import { graphqlDoor, type GraphQLDocument } from './door.js';

/** Where every host mounts GraphQL. */
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

/** What GraphQL answers to a `POST` or a `GET` on its path, or `undefined` for any other request. */
export async function answer(app: Parameters<typeof schemaOf>[0] & Pick<App, 'answer'>, request: Request, state: () => Promise<Record<string, unknown>>): Promise<Response | undefined> {
  const url = new URL(request.url);
  const method = request.method.toUpperCase();
  const surface = graphqlSurfaceOf(url.pathname);
  if ((method !== 'POST' && method !== 'GET') || (url.pathname !== GRAPHQL_PATH && !surface)) return undefined;

  const result = await app.answer(graphqlDoor(schemaOf(app, surface)), {
    ...(method === 'GET'
      ? { document: async () => documentOf(url.searchParams), readOnly: true }
      : { document: async () => (await jsonBodyOf(request)) as GraphQLDocument | undefined }),
    state: await state(),
    headers: request.headers,
  });
  if (result.status === 200) return responseOf(result);

  const { errors: [first] } = result.data as { errors: { message: string }[] };

  return responseOf({ ...result, data: { message: first!.message, ...(result.data as Record<string, unknown>) } });
}

function documentOf(search: URLSearchParams): GraphQLDocument {
  const variables = search.get('variables');
  let parsed: Record<string, unknown> | undefined;
  try {
    parsed = variables ? JSON.parse(variables) : undefined;
  } catch (cause) {
    throw new FougereError({ code: ErrorCode.BAD_REQUEST, message: 'The variables are not valid JSON.', cause });
  }

  return { query: search.get('query') ?? undefined, variables: parsed, operationName: search.get('operationName') ?? undefined };
}
