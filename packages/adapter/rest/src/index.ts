import './RestProtocol.js';
export { generateRoutes, type RouteDefinition } from './routes/RouteDefinition.js';
export type { HttpMethod, ResponseResult } from '@fougere/http';
export { PREFIX, prefixOf, type RestRoute } from './RestProtocol.js';
export { registerDescribed, registerRoutes, type RegisterOptions } from './register.js';
export { openApiOf, type OpenApiDocument } from './openapi/document.js';
export { describedAt, describedPaths, type DocsPage } from './openapi/described.js';
export { RestMiddleware, restDoor, type RestInvocation, type RestRequest, type RestResponse } from './door.js';

// The document is read off what the process SERVES, and published only on request. A schema GET
// once published every scanned entity, façade or not: the auth tables of a host that mounted it
// were readable by anyone.
