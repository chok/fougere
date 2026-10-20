import type { ResponseResult } from '@fougere/http';
import { prefixOf } from '../RestProtocol.js';
import type { AppLike } from '../routes/RouteDefinition.js';
import { openApiOf } from './document.js';

/** A file a page loads from a CDN, pinned, and its hash: a browser refuses one that was changed. */
interface Pinned {
  url: string;
  integrity: string;
}

const SWAGGER = {
  script: {
    url: 'https://cdn.jsdelivr.net/npm/swagger-ui-dist@5.33.1/swagger-ui-bundle.js',
    integrity: 'sha384-ZPehFMQommnnuaZ4rpxgkgTT2DKFVp4hZC/7pLit+9Lek9T1YGSo23eHFbvNkXkw',
  },
  style: {
    url: 'https://cdn.jsdelivr.net/npm/swagger-ui-dist@5.33.1/swagger-ui.css',
    integrity: 'sha384-Ov4/wv3j2bmct8cDc5X4ngJZohVPzEmc6uDPH8WeljUxO5vtoykvMEfbu9Vh6RaW',
  },
} satisfies Record<string, Pinned>;

const SCALAR: Pinned = {
  url: 'https://cdn.jsdelivr.net/npm/@scalar/api-reference@1.72.3/dist/browser/standalone.js',
  integrity: 'sha384-HWi/QCSPi64AQ0xBXFGDk+7gmvZ4hJ/7sZMIXqWVz6Ikb6+Cxej/hWKaomOStyFb',
};

/** The page that reads the document, by the word `openapi: { ui }` names it — `true` is Swagger UI. */
const PAGES = {
  swagger: (url: string) => page(
    `<link rel="stylesheet" href="${SWAGGER.style.url}" integrity="${SWAGGER.style.integrity}" crossorigin="anonymous">`,
    `<div id="swagger-ui"></div>
  <script src="${SWAGGER.script.url}" integrity="${SWAGGER.script.integrity}" crossorigin="anonymous"></script>
  <script>SwaggerUIBundle({ url: ${JSON.stringify(url)}, dom_id: '#swagger-ui' })</script>`,
  ),
  // Scalar sends usage to its makers unless told not to.
  scalar: (url: string) => page(
    '',
    `<div id="app"></div>
  <script src="${SCALAR.url}" integrity="${SCALAR.integrity}" crossorigin="anonymous"></script>
  <script>Scalar.createApiReference('#app', { url: ${JSON.stringify(url)}, telemetry: false })</script>`,
  ),
};

export type DocsPage = keyof typeof PAGES;

/**
 * What REST publishes of itself — `{prefix}/openapi.json` when `protocols: { rest: { openapi: {} } }`
 * says so, and `{prefix}/docs` reading it when `ui` says which page — or `undefined` for any other
 * request. Nothing is published without the line: the document names every op and what each refuses
 * at once, and a page loads code from elsewhere, which is a decision of its own.
 */
export function describedAt(app: AppLike, method: string, path: string): ResponseResult | undefined {
  const openapi = app.protocols?.rest?.openapi;
  if (method !== 'GET' || !openapi) return undefined;
  const prefix = prefixOf(app.protocols);

  if (path === `${prefix}/openapi.json`) return { status: 200, data: openApiOf(app) };
  const ui = openapi.ui === true ? 'swagger' : openapi.ui || undefined;
  if (ui && path === `${prefix}/docs`) {
    return { status: 200, data: PAGES[ui](`${prefix}/openapi.json`), raw: true, headers: { 'content-type': 'text/html; charset=utf-8' } };
  }

  return undefined;
}

/** The paths `describedAt` answers, for a router that mounts each one. */
export function describedPaths(app: AppLike): string[] {
  const openapi = app.protocols?.rest?.openapi;
  if (!openapi) return [];
  const prefix = prefixOf(app.protocols);

  return [`${prefix}/openapi.json`, ...(openapi.ui ? [`${prefix}/docs`] : [])];
}

function page(head: string, body: string): string {
  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>API reference</title>
  ${head}
</head>
<body>
  ${body}
</body>
</html>
`;
}
