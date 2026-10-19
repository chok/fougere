/** Serve a GraphQL schema on an HttpRouter — no Apollo, no Yoga needed. */
import { answerAt, ErrorCode, FougereError, type Answering } from '@fougere/core';
import type { HttpRouter, ResponseResult } from '@fougere/http';
import type { GraphQLSchema } from 'graphql';
import { graphqlDoor, type GraphQLDocument } from './door.js';

export interface GraphQLServeOptions {
  /** Route path. Default: '/graphql'. */
  path?: string;
  /** Enable GraphiQL playground on GET requests from browsers. Default: false. */
  playground?: boolean;
  /** The app's cycle, which watches each request — `app.answer`. Without it the door runs unwatched. */
  answer?: Answering;
}

function graphiqlHtml(path: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>GraphiQL — Fougere</title>
  <link rel="stylesheet" href="https://unpkg.com/graphiql@3/graphiql.min.css" />
  <style>body{margin:0;height:100vh}#graphiql{height:100vh}</style>
</head>
<body>
  <div id="graphiql"></div>
  <script src="https://unpkg.com/react@18/umd/react.production.min.js" crossorigin></script>
  <script src="https://unpkg.com/react-dom@18/umd/react-dom.production.min.js" crossorigin></script>
  <script src="https://unpkg.com/graphiql@3/graphiql.min.js" crossorigin></script>
  <script>
    const fetcher = GraphiQL.createFetcher({ url: '${path}' });
    const root = ReactDOM.createRoot(document.getElementById('graphiql'));
    root.render(React.createElement(GraphiQL, { fetcher }));
  </script>
</body>
</html>`;
}

/** Register a GraphQL endpoint on an HttpRouter. */
export function registerGraphQL(
  router: HttpRouter,
  schema: GraphQLSchema,
  options?: GraphQLServeOptions,
): void {
  const path = options?.path ?? '/graphql';
  const playground = options?.playground ?? false;
  const answer = options?.answer ?? answerAt;
  const door = graphqlDoor(schema);

  router.on('POST', path, (ctx) => answer(door, {
    document: async () => (await ctx.body()) as GraphQLDocument | undefined,
    state: ctx.state,
    headers: ctx.request.headers,
  }));

  router.on('GET', path, async (ctx): Promise<ResponseResult> => {
    // No query param → GraphiQL, when it was asked for: a page, not a request to the schema.
    if (!ctx.query.query && playground) {
      return { status: 200, data: graphiqlHtml(path), headers: { 'content-type': 'text/html' }, raw: true };
    }

    return answer(door, {
      document: async () => ({
        query: ctx.query.query,
        variables: variablesOf(ctx.query.variables),
        operationName: ctx.query.operationName,
      }),
      readOnly: true,
      state: ctx.state,
      headers: ctx.request.headers,
    });
  });
}

function variablesOf(written: string | undefined): Record<string, unknown> | undefined {
  if (!written) return undefined;
  try {
    return JSON.parse(written);
  } catch (cause) {
    throw new FougereError({ code: ErrorCode.BAD_REQUEST, message: 'The variables are not valid JSON.', cause });
  }
}
