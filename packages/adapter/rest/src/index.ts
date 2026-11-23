import './RestProtocol.js';
export { generateRoutes, type RouteDefinition } from './routes/RouteDefinition.js';
export type { HttpMethod, ResponseResult } from '@fougere/http';
export { PREFIX, prefixOf, type RestRoute } from './RestProtocol.js';
export { openApiOf, type OpenApiDocument } from './openapi/document.js';
export { describedAt, describedPaths, type DocsPage } from './openapi/described.js';
export { matchRoute, tableOf, type Matchable, type RouteMatch } from './routes/RouteMatch.js';
export { Rest, restDoor, type RestRequest } from './door.js';
export type { RestInvocation } from './RestInvocation.js';
export type { RestResponse } from './RestResponse.js';

