import type { ResponseResult } from '@fougere/http';
import { prefixOf } from '../RestProtocol.js';
import type { AppLike } from '../routes/RouteDefinition.js';
import { openApiOf } from './document.js';

/** Scalar, pinned: the page loads it from a CDN, so nothing reaches a bundle. */
const SCALAR = 'https://cdn.jsdelivr.net/npm/@scalar/api-reference@1.72.3';

/**
 * What REST publishes of itself, when `protocols: { rest: { openapi: true } }` says so —
 * `{prefix}/openapi.json`, and `{prefix}/docs` reading it — or `undefined` for any other request.
 * Nothing is published without the line: the document names every op and what each refuses at once.
 */
export function describedAt(app: AppLike, method: string, path: string): ResponseResult | undefined {
  if (method !== 'GET' || app.protocols?.rest?.openapi !== true) return undefined;
  const prefix = prefixOf(app.protocols);

  if (path === `${prefix}/openapi.json`) return { status: 200, data: openApiOf(app) };
  if (path === `${prefix}/docs`) {
    return { status: 200, data: pageOf(`${prefix}/openapi.json`), raw: true, headers: { 'content-type': 'text/html; charset=utf-8' } };
  }

  return undefined;
}

function pageOf(url: string): string {
  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>API reference</title>
</head>
<body>
  <div id="app"></div>
  <script src="${SCALAR}"></script>
  <script>Scalar.createApiReference('#app', { url: ${JSON.stringify(url)} })</script>
</body>
</html>
`;
}
