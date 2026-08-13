/**
 * Serve a GraphQL schema on an HttpRouter — no Apollo, no Yoga needed.
 *
 * Uses the `graphql` package directly for execution.
 * GraphiQL is available as an explicit opt-in for trusted development environments.
 */
import type { HttpRouter, ResponseResult } from '@fougere/http';
import { getOperationAST, graphql, parse, type GraphQLSchema } from 'graphql';

export interface GraphQLServeOptions {
  /** Route path. Default: '/graphql'. */
  path?: string;
  /** Enable GraphiQL playground on GET requests from browsers. Default: false. */
  playground?: boolean;
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

/**
 * Register a GraphQL endpoint on an HttpRouter.
 *
 * - POST: execute queries/mutations
 * - GET with `query` param: execute queries
 * - GET from browser (no `query` param): serve GraphiQL only with `playground: true`
 *
 * ```ts
 * import { registerGraphQL } from '@fougere/adapter-graphql'
 *
 * registerGraphQL(router, schema, { playground: process.env.NODE_ENV === 'development' })
 * ```
 */
export function registerGraphQL(
  router: HttpRouter,
  schema: GraphQLSchema,
  options?: GraphQLServeOptions,
): void {
  const path = options?.path ?? '/graphql';
  const playground = options?.playground ?? false;

  router.on('POST', path, async (ctx) => {
    const body = (await ctx.body()) as {
      query?: string;
      variables?: Record<string, unknown>;
      operationName?: string;
    };

    if (!body?.query) {
      return { status: 400, data: { errors: [{ message: 'Missing query' }] } };
    }

    const result = await graphql({
      schema,
      source: body.query,
      variableValues: body.variables,
      operationName: body.operationName,
    });

    return {
      status: 200,
      data: result,
      headers: { 'content-type': 'application/json' },
    };
  });

  router.on('GET', path, async (ctx): Promise<ResponseResult> => {
    // If there's a query param, execute it
    if (ctx.query.query) {
      let variables: Record<string, unknown> | undefined;
      let document;
      try {
        variables = ctx.query.variables ? JSON.parse(ctx.query.variables) : undefined;
        document = parse(ctx.query.query);
      } catch (err) {
        return { status: 400, data: { errors: [{ message: (err as Error).message }] } };
      }

      const operation = getOperationAST(document, ctx.query.operationName);
      if (operation && operation.operation !== 'query') {
        return {
          status: 405,
          data: { errors: [{ message: 'Only GraphQL queries may be executed over GET' }] },
          headers: { allow: 'POST' },
        };
      }

      const result = await graphql({
        schema,
        source: ctx.query.query,
        variableValues: variables,
        operationName: ctx.query.operationName,
      });

      return {
        status: 200,
        data: result,
        headers: { 'content-type': 'application/json' },
      };
    }

    // No query param → serve GraphiQL if enabled
    if (playground) {
      return {
        status: 200,
        data: graphiqlHtml(path),
        headers: { 'content-type': 'text/html' },
        raw: true,
      };
    }

    return { status: 400, data: { errors: [{ message: 'Missing query parameter' }] } };
  });
}
