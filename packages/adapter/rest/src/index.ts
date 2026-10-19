import './RestProtocol.js';
export { generateRoutes, type RouteDefinition } from './routes/RouteDefinition.js';
export type { HttpMethod, ResponseResult } from '@fougere/http';
export { PREFIX, prefixOf, type RestRoute } from './RestProtocol.js';
export { registerRoutes, type RegisterOptions } from './register.js';
export { RestMiddleware, restDoor, type RestInvocation, type RestRequest, type RestResponse } from './door.js';

// No schema endpoint here. Discovery is `rpc.discover` on the envelope — one
// surface, which answers with what the host SERVES. A second GET published
// every scanned entity instead, façade or not: the auth tables of a host that
// mounted it were readable by anyone.
